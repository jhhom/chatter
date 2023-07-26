import { KyselyDB, TopicEvent } from "~/backend/schema";
import { ok, err } from "neverthrow";
import {
  getPrecedingMessageDate,
  getIsFirstOfDateForMessages,
  getLastReadSequenceId,
} from "~/backend/service/topics/common/repo/repo";
import { getSubscriptionPeriods } from "~/backend/service/topics/common/repo/get-subscription-period";
import { MessageContent } from "~/api-contract/subscription/subscription";
import { getGroupPeersLastReadSeqId } from "~/backend/service/topics/common/repo/repo";
import {
  UserId,
  P2PTopicId,
  GroupTopicId,
} from "~/api-contract/subscription/subscription";
import {
  formatQueriedMessage,
  getMessagesQuery,
} from "~/backend/service/topics/common/repo/get-messages";
import { fromPromise } from "neverthrow";
import { sql } from "kysely";

export type Message = {
  isFirstOfDate: boolean;
  type: "message";
  content: MessageContent;
  sequenceId: number;
  createdAt: Date;
  author: `usr${string}`;
  deleted: boolean;
};

export type Event = {
  type: "event_log";
  event: TopicEvent;
  createdAt: Date;
  sequenceId: number;
  content: Omit<Extract<MessageContent, { type: "text" }>, "replyTo">;
  read: boolean;
};

export async function getMessagesOfTopic(
  db: KyselyDB,
  arg: {
    /** the user requesting the messages */
    userId: UserId;
    topic:
      | {
          type: "p2p";
          id: P2PTopicId;
          peerId: UserId;
        }
      | {
          type: "grp";
          id: GroupTopicId;
        };
    afterSequenceId: number;
  }
) {
  // The flow of getting all the messages of a topic after a given sequence id
  // ---------------------------------------------------------
  // 1. Specify the filter for the messages as messages matching the topic and have higher sequence id than the given
  //    1.1 If the topic is a group topic, add additional filters to only get the messages during the user's subscription period to the group
  // 2. Get all the messages and event logs
  // 3. Determine the isFirstOfDate of every message
  // 4. Get the read status of user's authored messages based on the peer's last read sequence id

  let query = getMessagesQuery(db, { requesterUserId: arg.userId })
    .where("messages.topicId", "=", arg.topic.id)
    .where("messages.sequenceId", ">", arg.afterSequenceId);

  if (arg.topic.type == "grp") {
    const subscriptionPeriod = await getSubscriptionPeriods(db, {
      requesterUserId: arg.userId,
      topicId: arg.topic.id,
    });
    if (subscriptionPeriod.isErr()) {
      return err(subscriptionPeriod.error);
    }
    const subscriptionPeriods = subscriptionPeriod.value.periods;

    query = query.where(({ or, and, eb }) =>
      or(
        subscriptionPeriods.map((p) =>
          p.length === 2
            ? and([
                eb("messages.sequenceId", ">=", p[0]),
                eb("messages.sequenceId", "<=", p[1]),
              ])
            : eb("messages.sequenceId", ">=", p[0])
        )
      )
    );
  }

  const topicItemsResult = await fromPromise(query.execute(), (e) => e).map(
    (v) =>
      v
        // filter out messages that is deleted for self
        .filter((m) => {
          return (
            m.messageDeleteLogs.findIndex((x) => x.deletedFor == "self") == -1
          );
        })
        .map(formatQueriedMessage({ requesterUserId: arg.userId }))
  );
  if (topicItemsResult.isErr()) {
    return err(topicItemsResult.error);
  }

  if (topicItemsResult.value.length == 0) {
    return ok({
      messages: [],
      eventLogs: [],
    });
  }

  // 3. ⭐️ DETERMINE THE ISFIRSTOFDATE OF EVERY MESSAGE
  const p = await getPrecedingMessageDate(db, {
    topicId: arg.topic.id,
    beforeSequenceId: topicItemsResult.value[0].sequenceId,
  });
  if (p.isErr()) {
    return err(p.error);
  }

  const msgsWithFirstOfDate = getIsFirstOfDateForMessages(
    topicItemsResult.value,
    p.value
  );

  const resultMessages = msgsWithFirstOfDate.filter(
    (m) => m.type == "message"
  ) as (Message & { isFirstOfDate: boolean })[];
  const eventLogs = msgsWithFirstOfDate.filter(
    (m) => m.type == "event_log"
  ) as (Event & { isFirstOfDate: boolean })[];

  // 4. ⭐️ GET THE READ STATUS OF USER'S AUTHORED MESSAGES BASED ON THE PEER'S LAST READ SEQUENCE ID
  let messagesWithReadStatus = [];
  if (arg.topic.type == "grp") {
    // if user is not the author: read is false
    // otherwise: read is based on whether others have read author's messages

    const peerLastReadSeqIdResult = await getGroupPeersLastReadSeqId(db, {
      requesterGroupMemberId: arg.userId,
      topicId: arg.topic.id,
    });
    if (peerLastReadSeqIdResult.isErr()) {
      return err(peerLastReadSeqIdResult.error);
    }

    messagesWithReadStatus = resultMessages.map((m) => ({
      ...m,
      read:
        m.author == arg.userId
          ? peerLastReadSeqIdResult.value === null
            ? false
            : m.sequenceId <= peerLastReadSeqIdResult.value
          : false,
    }));
  } else {
    const peerLastReadSeqIdResult = await getLastReadSequenceId(db, {
      userId: arg.topic.peerId,
      topicId: arg.topic.id,
    });
    if (peerLastReadSeqIdResult.isErr()) {
      return err(peerLastReadSeqIdResult.error);
    }

    messagesWithReadStatus = resultMessages.map((m) => {
      if (m.author != arg.userId) {
        return {
          ...m,
          read: false,
        };
      }

      return {
        ...m,
        read: m.sequenceId <= peerLastReadSeqIdResult.value,
      };
    });
  }

  return ok({
    messages: messagesWithReadStatus,
    eventLogs: eventLogs.map((l) => ({
      ...l,
      read: false,
    })),
  });
}

export async function getTopicsOfUser(db: KyselyDB, userId: UserId) {
  const p2pTopics = await fromPromise(
    db
      .selectFrom("topics")
      .innerJoin("subscriptions as peer", (join) =>
        join
          .onRef("peer.topicId", "=", "topics.id")
          .on("peer.userId", "!=", userId)
      )
      .innerJoin("subscriptions as requester", (join) =>
        join
          .onRef("requester.topicId", "=", "topics.id")
          .on("requester.userId", "=", userId)
      )
      .innerJoin("users", "users.id", "peer.userId")
      .select([
        "users.id as topicUserId",
        "topics.id as topicId",
        "users.fullname as topicName",
        "requester.readSeqId as lastReadSequenceId",
      ])
      .where("topics.id", "like", "p2p%")
      .execute(),
    (e) => e
  );
  if (p2pTopics.isErr()) {
    return err(p2pTopics.error);
  }

  const grpTopicsWithSubscriptionsResult = await fromPromise(
    db
      .selectFrom("topics")
      .innerJoin("subscriptions", "subscriptions.topicId", "topics.id")
      .innerJoin("groupTopicMeta", "groupTopicMeta.topicId", "topics.id")
      .select([
        "topics.id as topicId",
        "subscriptions.readSeqId as lastReadSequenceId",
        "groupTopicMeta.groupName as topicName",
      ])
      .where("topics.id", "like", "grp%")
      .where("subscriptions.userId", "=", userId)
      .execute(),
    (e) => e
  );
  if (grpTopicsWithSubscriptionsResult.isErr()) {
    return err(grpTopicsWithSubscriptionsResult.error);
  }
  const grpTopicsWithSubscriptions = grpTopicsWithSubscriptionsResult.value as {
    topicId: GroupTopicId;
    lastReadSequenceId: number | null;
    topicName: string;
  }[];

  const pastGroupTopicsOfUserResult = await getPastGroupTopicsOfUser(
    db,
    userId
  );

  if (pastGroupTopicsOfUserResult.isErr()) {
    return err(pastGroupTopicsOfUserResult.error);
  }

  return ok({
    grpTopics: grpTopicsWithSubscriptions.concat(
      pastGroupTopicsOfUserResult.value
    ),
    p2pTopics: p2pTopics.value,
  });
}

export async function getPastGroupTopicsOfUser(db: KyselyDB, userId: UserId) {
  const r = await fromPromise(
    db
      .selectFrom("topicEventLogs")
      // we join group topic meta, because we want to exclude the logs of P2P topics
      .innerJoin(
        "groupTopicMeta",
        "groupTopicMeta.topicId",
        "topicEventLogs.topicId"
      )
      .select((eb) => [
        sql<GroupTopicId>`DISTINCT ${eb.ref("topicEventLogs.topicId")}`.as(
          "topicId"
        ),
      ])
      .where(({ or, eb, and }) =>
        or([
          and([
            eb("affectedUserId", "=", userId),
            eb("topicEvent", "=", "remove_member"),
          ]),
          and([
            eb("actorUserId", "=", userId),
            eb("topicEvent", "=", "leave_group"),
          ]),
        ])
      )
      .execute(),
    (e) => e
  );
  if (r.isErr()) {
    return err(r.error);
  }

  if (r.value.length == 0) {
    return ok([]);
  }

  const removedTopics = r.value;

  const presentSubscriptionsResult = await fromPromise(
    db
      .selectFrom("subscriptions")
      .select("topicId")
      .where("userId", "=", userId)
      .where(
        "topicId",
        "in",
        removedTopics.map((t) => t.topicId)
      )
      .execute(),
    (e) => e
  );
  if (presentSubscriptionsResult.isErr()) {
    return err(presentSubscriptionsResult.error);
  }
  const presentTopicIds = presentSubscriptionsResult.value.map(
    (v) => v.topicId
  );

  const currentRemovedTopics = removedTopics.filter(
    (v) => presentTopicIds.lastIndexOf(v.topicId) === -1
  );

  // for every topic
  // there could be possibly many `topic_event_log_meta_remove_member` (if user has been removed multiple times)
  // we want to get the last one only
  // for this reason, we may have to perform a select one by one for every topic
  // otherwise we can use `DISTINCT ON`

  type RemovedGroupTopic = {
    topicId: GroupTopicId;
    lastReadSequenceId: number | null;
    topicName: string;
  };

  const removedTopicsInfo: RemovedGroupTopic[] = [];

  // for every topic
  // there could be possibly many `topic_event_log_meta_remove_member` (if user has been removed multiple times)
  // we want to get the last one only
  // for this reason, we may have to perform a select one by one for every topic
  // otherwise we can use `DISTINCT ON`

  for (const t of currentRemovedTopics) {
    const r = await fromPromise(
      db
        .selectFrom("subscriptions")
        .innerJoin(
          "topicEventLogs",
          "topicEventLogs.topicId",
          "subscriptions.topicId"
        )
        .innerJoin(
          "topicEventLogMetaRemoveMember",
          "topicEventLogMetaRemoveMember.id",
          "topicEventLogs.id"
        )
        .innerJoin(
          "groupTopicMeta",
          "groupTopicMeta.topicId",
          "subscriptions.topicId"
        )
        .select([
          "subscriptions.topicId",
          "topicEventLogMetaRemoveMember.readSeqId as lastReadSequenceId",
          "groupTopicMeta.groupName as topicName",
        ])
        .where("subscriptions.topicId", "=", t.topicId)
        .orderBy("topicEventLogMetaRemoveMember.createdAt", "desc")
        .limit(1)
        .executeTakeFirst(),
      (e) => e
    );
    if (r.isErr()) {
      return err(r.error);
    }
    if (r.value !== undefined) {
      removedTopicsInfo.push(r.value as RemovedGroupTopic);
    }
  }

  return ok(removedTopicsInfo);
}

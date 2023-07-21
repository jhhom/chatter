import { fromPromise, ok, err } from "neverthrow";
import { sql, inArray, desc, and, eq, not, like, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { AppPgDatabase } from "~/backend/drizzle/db";
import {
  subscriptions,
  users,
  topics,
  groupTopicMeta,
  topicEventLogs,
  topicEventLogMetaRemoveMember,
  P2PTopicId,
  UserId,
  GroupTopicId,
} from "~/backend/drizzle/schema";
import { completeMediaUrl } from "~/backend/service/topics/use-cases/send-message/media";

import { ServiceResult } from "~/api-contract/types";
import { AppError } from "~/api-contract/errors/errors";

import {
  Message,
  Event,
  getMessagesOfTopic,
} from "./get-unread-messages-per-topic.repo";

type TopicMessage = Omit<Message, "type"> & {
  isFirstOfDate: boolean;
  read: boolean;
};
type TopicEventLog = Omit<Event, "type"> & {
  isFirstOfDate: boolean;
  read: boolean;
};

export async function getAllUnreadMessages(
  db: AppPgDatabase,
  input: {
    userId: UserId;
  }
): ServiceResult<"topic/unread_messages"> {
  // The flow of getting all unread messages of a user
  // ---------------------------------------------------------
  // 1. Get all the topics user is subscribed to and their last read sequence id on each topic
  // 2. For every topic, get all the messages of that topic after the user's last read sequence id

  // 1. ⭐️ GET ALL THE TOPICS USER IS SUBSCRIBED TO AND THEIR LAST READ SEQUENCE ID ON EACH TOPIC
  const topics = await getTopicsOfUser({ db }, { userId: input.userId });
  if (topics.isErr()) {
    return err(new AppError("UNKNOWN", { cause: topics.error }));
  }
  const { p2pTopics, grpTopics } = topics.value;

  const topicMessages: {
    p2pTopics: {
      topic: {
        id: UserId;
        name: string;
      };
      messages: TopicMessage[];
      eventLogs: TopicEventLog[];
    }[];
    grpTopics: {
      topic: {
        id: GroupTopicId;
        name: string;
      };
      messages: TopicMessage[];
      eventLogs: TopicEventLog[];
    }[];
  } = {
    p2pTopics: [],
    grpTopics: [],
  };

  // 2. ⭐️ GET ALL THE MESSAGES OF THAT TOPIC AFTER THE USER'S LAST READ SEQUENCE ID
  for (const t of p2pTopics) {
    const unread = await getMessagesOfTopic(db, {
      userId: input.userId,
      topic: {
        type: "p2p",
        id: t.topicId as P2PTopicId,
        peerId: t.topicUserId,
      },
      afterSequenceId: t.lastReadSequenceId ? t.lastReadSequenceId : 0,
    });

    if (unread.isErr()) {
      return err(new AppError("UNKNOWN", { cause: unread.error }));
    }

    topicMessages.p2pTopics.push({
      topic: {
        id: t.topicUserId,
        name: t.topicName,
      },
      messages: unread.value.messages.map((m) => {
        if (m.content.type == "picture" || m.content.type == "file") {
          m.content.url = completeMediaUrl(m.content.url);
        }
        if (
          m.type == "message" &&
          m.content.replyTo !== null &&
          m.content.replyTo.type == "picture"
        ) {
          m.content.replyTo.url = completeMediaUrl(m.content.replyTo.url);
        }
        return m;
      }),
      eventLogs: unread.value.eventLogs,
    });
  }

  for (const t of grpTopics) {
    const unread = await getMessagesOfTopic(db, {
      userId: input.userId,
      topic: {
        type: "grp",
        id: t.topicId as GroupTopicId,
      },
      afterSequenceId: t.lastReadSequenceId ? t.lastReadSequenceId : 0,
    });

    if (unread.isErr()) {
      return err(new AppError("UNKNOWN", { cause: unread.error }));
    }

    topicMessages.grpTopics.push({
      topic: {
        id: t.topicId,
        name: t.topicName,
      },
      messages: unread.value.messages.map((m) => {
        if (m.content.type == "picture" || m.content.type == "file") {
          m.content.url = completeMediaUrl(m.content.url);
        }
        if (
          m.type == "message" &&
          m.content.replyTo !== null &&
          m.content.replyTo.type == "picture"
        ) {
          m.content.replyTo.url = completeMediaUrl(m.content.replyTo.url);
        }
        return m;
      }),
      eventLogs: unread.value.eventLogs,
    });
  }

  console.log(JSON.stringify(topicMessages));

  return ok(topicMessages);
}

export async function getTopicsOfUser(
  ctx: { db: AppPgDatabase },
  input: { userId: UserId }
) {
  const requester = alias(subscriptions, "requester");
  const peer = alias(subscriptions, "peer");

  const p2pTopics = await fromPromise(
    ctx.db
      .select({
        topicUserId: users.id,
        topicId: topics.id,
        topicName: users.fullname,
        lastReadSequenceId: requester.readSeqId,
      })
      .from(topics)
      .innerJoin(
        peer,
        and(eq(peer.topicId, topics.id), not(eq(peer.userId, input.userId)))
      )
      .innerJoin(
        requester,
        and(
          eq(requester.topicId, topics.id),
          eq(requester.userId, input.userId)
        )
      )
      .innerJoin(users, eq(peer.userId, users.id))
      .where(like(topics.id, "p2p%")),
    (e) => e
  );
  if (p2pTopics.isErr()) {
    return err(p2pTopics.error);
  }

  const grpTopicsWithSubscriptionsResult = await fromPromise(
    ctx.db
      .select({
        topicId: topics.id,
        lastReadSequenceId: subscriptions.readSeqId,
        topicName: groupTopicMeta.groupName,
      })
      .from(topics)
      .innerJoin(subscriptions, eq(subscriptions.topicId, topics.id))
      .innerJoin(groupTopicMeta, eq(groupTopicMeta.topicId, topics.id))
      .where(
        and(like(topics.id, "grp%"), eq(subscriptions.userId, input.userId))
      ),
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

  const pastGroupTopicsOfUserResult = await getPastGroupTopicsOfUser(ctx.db, {
    userId: input.userId,
  });

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

export async function getPastGroupTopicsOfUser(
  db: AppPgDatabase,
  input: {
    userId: UserId;
  }
) {
  const r = await fromPromise(
    db
      .select({
        topicId: sql<GroupTopicId>`DISTINCT topic_event_logs.topic_id`,
      })
      .from(topicEventLogs)
      .innerJoin(
        groupTopicMeta,
        eq(groupTopicMeta.topicId, topicEventLogs.topicId)
      )
      .where(
        or(
          and(
            eq(topicEventLogs.affectedUserId, input.userId),
            eq(topicEventLogs.topicEvent, "remove_member")
          ),
          and(
            eq(topicEventLogs.actorUserId, input.userId),
            eq(topicEventLogs.topicEvent, "leave_group")
          )
        )
      ),
    (e) => {
      return e;
    }
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
      .select({
        topicId: subscriptions.topicId,
      })
      .from(subscriptions)
      .where(
        and(
          inArray(
            subscriptions.topicId,
            r.value.map((t) => t.topicId)
          ),
          eq(subscriptions.userId, input.userId)
        )
      ),
    (e) => e
  );
  if (presentSubscriptionsResult.isErr()) {
    return err(presentSubscriptionsResult.error);
  }
  const presentTopicIds = presentSubscriptionsResult.value.map(
    (v) => v.topicId
  );

  const currentRemovedTopics = removedTopics.filter(
    (v) => presentTopicIds.lastIndexOf(v.topicId) == -1
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

  let removedTopicsInfo: RemovedGroupTopic[] = [];

  for (const t of currentRemovedTopics) {
    const r = await fromPromise(
      db
        .select({
          topicId: subscriptions.topicId,
          lastReadSequenceId: topicEventLogMetaRemoveMember.readSeqId,
          topicName: groupTopicMeta.groupName,
        })
        .from(subscriptions)
        .innerJoin(
          topicEventLogs,
          eq(topicEventLogs.topicId, subscriptions.topicId)
        )
        .innerJoin(
          topicEventLogMetaRemoveMember,
          eq(topicEventLogMetaRemoveMember.id, topicEventLogs.id)
        )
        .innerJoin(
          groupTopicMeta,
          eq(groupTopicMeta.topicId, subscriptions.topicId)
        )
        .where(eq(subscriptions.topicId, t.topicId))
        .orderBy(desc(topicEventLogMetaRemoveMember.createdAt))
        .limit(1),
      (e) => e
    );
    if (r.isErr()) {
      return err(r.error);
    }
    if (r.value.length != 0) {
      removedTopicsInfo.push(r.value[0] as RemovedGroupTopic);
    }
  }

  return ok(removedTopicsInfo);
}

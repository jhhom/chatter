import { asc, and, eq, gt, SQL, gte, lte, InferModel, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { fromPromise, ok, err } from "neverthrow";
import { match } from "ts-pattern";

import { AppPgDatabase, jsonAggBuildObject } from "~/backend/drizzle/db";
import {
  messages,
  UserId,
  users,
  TopicId,
  topicEventLogs,
  GroupTopicId,
  P2PTopicId,
  messageDeleteLogs,
  messageReplyLogs,
  TopicEventType,
} from "~/backend/drizzle/schema";
import { getSubscriptionPeriods } from "~/backend/service/topics/use-cases/get-messages-until-reply/get-group-topic-messages";
import {
  getPrecedingMessageDate,
  getIsFirstOfDateForMessages,
  getLastReadSequenceId,
} from "~/backend/service/topics/common/repo";
import { MessageContent } from "~/api-contract/subscription/subscription";
import { getGroupPeersLastReadSeqId } from "~/backend/service/topics/common/get-group-peer-last-read";

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
  event: TopicEventType;
  createdAt: Date;
  sequenceId: number;
  content: Omit<Extract<MessageContent, { type: "text" }>, "replyTo">;
  read: boolean;
};

export async function getMessagesOfTopic(
  db: AppPgDatabase,
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

  // 1. ⭐️ SPECIFY THE FILTER FOR THE MESSAGES AS MESSAGES MATCHING THE TOPIC AND HAVE HIGHER SEQUENCE ID THAN THE GIVEN
  let topicItemsFilter: SQL<unknown>[] = [
    eq(messages.topicId, arg.topic.id),
    gt(messages.sequenceId, arg.afterSequenceId),
  ];

  // 1.1 ⭐️ IF THE TOPIC IS A GROUP TOPIC, ADD ADDITIONAL FILTERS TO ONLY GET THE MESSAGES DURING THE USER'S SUBSCRIPTION PERIOD TO THE GROUP
  if (arg.topic.type == "grp") {
    const subscriptionPeriod = await getSubscriptionPeriods(db, {
      requesterUserId: arg.userId,
      topicId: arg.topic.id,
    });
    if (subscriptionPeriod.isErr()) {
      return err(subscriptionPeriod.error);
    }
    const subscriptionPeriods = subscriptionPeriod.value.periods;

    const periodFilters = or(
      ...subscriptionPeriods.map((p) =>
        p.length == 2
          ? and(gte(messages.sequenceId, p[0]), lte(messages.sequenceId, p[1]))
          : gte(messages.sequenceId, p[0])
      )
    );
    if (periodFilters) {
      topicItemsFilter.push(periodFilters);
    }
  }

  // 2. ⭐️ GET ALL THE MESSAGES AND EVENT LOGS
  const affected = alias(users, "affected");
  const actor = alias(users, "actor");
  const replyToMessage = alias(messages, "reply_to_message");

  const topicItemsResult = await fromPromise(
    db
      .select({
        content: messages.content,
        sequenceId: messages.sequenceId,
        author: messages.authorId,
        createdAt: messages.createdAt,
        topicEventLogs: topicEventLogs,
        eventActor: {
          name: actor.fullname,
        },
        eventAffected: {
          name: affected.fullname,
        },
        messageDeleteLogs: jsonAggBuildObject(
          {
            deletedFor: messageDeleteLogs.deletedFor,
          },
          "message_delete_logs"
        ),
        messageReplyTo: {
          sequenceId: replyToMessage.sequenceId,
          content: replyToMessage.content,
          authorId: replyToMessage.authorId,
        },
      })
      .from(messages)
      .orderBy(asc(messages.sequenceId))
      .where(and(...topicItemsFilter))
      .groupBy(
        messages.id,
        topicEventLogs.id,
        actor.id,
        affected.id,
        replyToMessage.id
      )
      .leftJoin(messageReplyLogs, eq(messages.id, messageReplyLogs.messageId))
      .leftJoin(
        replyToMessage,
        eq(messageReplyLogs.replyToMessage, replyToMessage.id)
      )
      .leftJoin(topicEventLogs, eq(topicEventLogs.messageId, messages.id))
      .leftJoin(actor, eq(topicEventLogs.actorUserId, actor.id))
      .leftJoin(affected, eq(topicEventLogs.affectedUserId, affected.id))
      .leftJoin(
        messageDeleteLogs,
        and(
          eq(messageDeleteLogs.messageId, messages.id),
          or(
            eq(messageDeleteLogs.deletedFor, "everyone"),
            and(
              eq(messageDeleteLogs.deletedFor, "self"),
              eq(messageDeleteLogs.deletedBy, arg.userId)
            )
          )
        )
      ),
    (e) => e
  ).map((v) =>
    v
      // filter out messages that is deleted for self
      .filter((m) => {
        return (
          m.messageDeleteLogs.findIndex((x) => x.deletedFor == "self") == -1
        );
      })
      .map((i) => {
        if (i.author == null) {
          const l = i.topicEventLogs!;
          const actorName =
            arg.userId == l.actorUserId
              ? "You"
              : i.eventActor
              ? i.eventActor.name
              : "";
          const affectedName =
            arg.userId == l.affectedUserId
              ? "You"
              : i.eventAffected
              ? i.eventAffected.name
              : "";

          const content: NonNullable<InferModel<typeof messages>["content"]> = {
            type: "text",
            forwarded: false,
            content: match(l.topicEvent)
              .with("add_member", () => `${actorName} added ${affectedName}`)
              .with(
                "change_member_permission",
                () => `${actorName} changed ${affectedName}'s permission`
              )
              .with(
                "remove_member",
                () => `${actorName} removed ${affectedName}`
              )
              .with("create_group", () => `${actorName} created the group`)
              .with(
                "join-group-through-id",
                () => `${actorName} joined the group by id`
              )
              .with(
                "join-group-through-invite-link",
                () => `${actorName} joined the group through invite link`
              )
              .with("leave_group", () => `${actorName} left the group`)
              .exhaustive(),
          };

          return {
            type: "event_log" as const,
            event: l.topicEvent,
            createdAt: new Date(l.createdAt),
            sequenceId: i.sequenceId,
            content,
            read: false,
          };
        } else {
          let deleted =
            i.messageDeleteLogs.findIndex((x) => x.deletedFor == "everyone") !=
            -1;

          if (deleted) {
            return {
              type: "message" as const,
              sequenceId: i.sequenceId,
              content: {
                type: "text" as const,
                content: "",
                forwarded: false,
                replyTo: null,
              },
              author: i.author,
              createdAt: new Date(i.createdAt),
              deleted,
            };
          }

          return {
            type: "message" as const,
            sequenceId: i.sequenceId,
            content: {
              ...i.content!,
              replyTo:
                i.messageReplyTo === null
                  ? null
                  : {
                      ...i.messageReplyTo.content!,
                      authorId: i.messageReplyTo.authorId!,
                      seqId: i.messageReplyTo.sequenceId,
                    },
            },
            author: i.author,
            createdAt: new Date(i.createdAt),
            deleted,
          };
        }
      })
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

  const msgsWithFirstOfDate = await getIsFirstOfDateForMessages(
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
    const peerLastReadSeqIdResult = await getLastReadSequenceId(
      db,
      arg.topic.peerId,
      arg.topic.id
    );
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
    eventLogs,
  });
}

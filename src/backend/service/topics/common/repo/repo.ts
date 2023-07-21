import type { KyselyDB, TopicEvent, KyselyTransaction } from "~/backend/schema";
import {
  GroupTopicId,
  UserId,
  TopicId,
  MessageContent,
} from "~/api-contract/subscription/subscription";
import { fromPromise, err, ok, errAsync, okAsync, Result } from "neverthrow";
import { AppError } from "~/api-contract/errors/errors";
import { Message } from "~/api-contract/subscription/subscription";
import { Expression, SqlBool, sql } from "kysely";
import { IsUserId } from "~/backend/service/common/topics";

export async function getGroupMembers(
  db: KyselyDB,
  input: {
    groupTopicId: GroupTopicId;
  }
) {
  return fromPromise(
    db
      .selectFrom("subscriptions")
      .innerJoin("users", (join) =>
        join.onRef("users.id", "=", "subscriptions.userId")
      )
      .select([
        "users.id",
        "users.username",
        "users.fullname",
        "users.profilePhotoUrl",
      ])
      .where("subscriptions.topicId", "=", input.groupTopicId)
      .execute(),
    (e) => e
  );
}

export async function getPrecedingMessageDate(
  db: KyselyDB,
  arg: {
    topicId: TopicId;
    beforeSequenceId: number;
  }
) {
  let precedingMessageDate: Date | undefined;

  const precedingMsgResult = await fromPromise(
    db
      .selectFrom("messages")
      .select("messages.createdAt")
      .where("messages.topicId", "=", arg.topicId)
      .where("messages.sequenceId", "<", arg.beforeSequenceId)
      .orderBy("messages.sequenceId", "desc")
      .executeTakeFirst(),
    (e) => e
  );

  if (precedingMsgResult.isErr()) {
    return err(precedingMsgResult.error);
  }

  if (precedingMsgResult.value !== undefined) {
    precedingMessageDate = new Date(precedingMsgResult.value.createdAt);
  }
  return ok(precedingMessageDate);
}

export function getTopicIdOfP2PTopicBetween(
  db: KyselyDB,
  args: {
    topicUser1: UserId;
    topicUser2: UserId;
  }
) {
  return fromPromise(
    db
      .selectFrom("topics")
      .select("topics.id")
      .innerJoin("subscriptions as sub1", "sub1.topicId", "topics.id")
      .innerJoin("subscriptions as sub2", "sub2.topicId", "topics.id")
      .where("sub1.userId", "=", args.topicUser1)
      .where("sub2.userId", "=", args.topicUser2)
      .where("topics.topicType", "=", "p2p")
      .executeTakeFirst(),
    (e) => ({ type: "database", cause: e } as const)
  ).andThen((v) => {
    if (v === undefined) {
      return errAsync({ type: "topic not exist" } as const);
    }
    return okAsync({ topicId: v.id });
  });
}

export function existUser(db: KyselyDB, userId: UserId) {
  return fromPromise(
    db
      .selectFrom("users")
      .select("users.id")
      .where("users.id", "=", userId)
      .executeTakeFirst(),
    (e) => e
  ).map((v) => v !== undefined);
}

export function getSubscribersOfTopic(db: KyselyDB, topicId: GroupTopicId) {
  return fromPromise(
    db
      .selectFrom("subscriptions")
      .innerJoin("users", "users.id", "subscriptions.userId")
      .select([
        "subscriptions.userId as subscriberId",
        "users.fullname as subscriberName",
      ])
      .where("subscriptions.topicId", "=", topicId)
      .execute(),
    (e) => e
  );
}

export function getP2PTopicProfile(
  tx: KyselyDB | KyselyTransaction,
  arg: {
    user1Id: UserId;
    user2Id: UserId;
  }
) {
  return fromPromise(
    tx
      .selectFrom("topics")
      .innerJoin("users as user1", (join) =>
        join.on("user1.id", "=", arg.user1Id)
      )
      .innerJoin("users as user2", (join) =>
        join.on("user2.id", "=", arg.user2Id)
      )
      .innerJoin("subscriptions as user1_sub", (join) =>
        join
          .on("user1_sub.userId", "=", arg.user1Id)
          .on(({ not, eb }) => not(eb("user1_sub.userId", "=", arg.user2Id)))
      )
      .innerJoin("subscriptions as user2_sub", (join) =>
        join
          .on("user2_sub.userId", "=", arg.user2Id)
          .on(({ not, eb }) => not(eb("user2_sub.userId", "=", arg.user1Id)))
      )
      .select([
        "user1.fullname as user1Name",
        "user1.profilePhotoUrl as user1ProfilePhotoUrl",
        "user1_sub.permissions as user1Permissions",
        "user2.fullname as user2Name",
        "user2.profilePhotoUrl as user2ProfilePhotoUrl",
        "user2_sub.permissions as user2Permissions",
      ])
      .where("topics.topicType", "=", "p2p")
      .whereRef("topics.id", "=", "user1_sub.topicId")
      .whereRef("topics.id", "=", "user2_sub.topicId")
      .executeTakeFirstOrThrow(),
    (e) => new AppError("DATABASE", { cause: e })
  );
}

export type MessagesResultEventLogs = {
  type: "event_log";
  event: TopicEvent;
  content: Extract<Message, { type: "text" }>;
  sequenceId: number;
  createdAt: Date;
  isFirstOfDate: boolean;
};

export type MessagesResultMessages = {
  type: "message";
  author: UserId;
  content: MessageContent;
  sequenceId: number;
  createdAt: Date;
  isFirstOfDate: boolean;
  deleted: boolean;
};

export type MessagesResult = MessagesResultEventLogs | MessagesResultMessages;

/**
 * Assumes messages is already sorted by sequence id in ascending order (low to high)
 *
 * @param messages
 */
export function getIsFirstOfDateForMessages(
  messages: (
    | Omit<MessagesResultEventLogs, "isFirstOfDate">
    | Omit<MessagesResultMessages, "isFirstOfDate">
  )[],
  precedingFirstMessageDate?: Date
) {
  if (messages.length == 0) {
    return [];
  }
  let currentDate: undefined | string = undefined;
  const messagesWithFirstOfDate: (
    | MessagesResultEventLogs
    | MessagesResultMessages
  )[] = [];

  for (const [i, m] of messages.entries()) {
    if (i == 0 && precedingFirstMessageDate != undefined) {
      if (
        new Date(m.createdAt).toDateString() !=
        precedingFirstMessageDate.toDateString()
      ) {
        messagesWithFirstOfDate.push({
          ...m,
          isFirstOfDate: true,
        });
      } else {
        messagesWithFirstOfDate.push({
          ...m,
          isFirstOfDate: false,
        });
      }
      currentDate = m.createdAt.toDateString();
    } else {
      if (
        currentDate == undefined ||
        currentDate != m.createdAt.toDateString()
      ) {
        messagesWithFirstOfDate.push({
          ...m,
          isFirstOfDate: true,
        });
        currentDate = m.createdAt.toDateString();
      } else {
        messagesWithFirstOfDate.push({
          ...m,
          isFirstOfDate: false,
        });
      }
    }
  }

  return messagesWithFirstOfDate;
}

export function getLastReadSequenceId(
  db: KyselyDB,
  { userId, topicId }: { userId: UserId; topicId: TopicId }
) {
  return fromPromise(
    db
      .selectFrom("subscriptions")
      .select("readSeqId as lastReadSeqId")
      .where("subscriptions.userId", "=", userId)
      .where("subscriptions.topicId", "=", topicId)
      .executeTakeFirstOrThrow(),
    (e) => e
  ).map((v) => (v.lastReadSeqId === null ? 0 : v.lastReadSeqId));
}

export function hasMessagesEarlierThan(
  db: KyselyDB,
  arg: {
    topicId: TopicId;
    beforeSequenceId: number;
    subscriptionStartSequenceId: number | null;
  }
) {
  return fromPromise(
    db
      .selectFrom("messages")
      .select(sql<boolean>`COUNT(id) > 0`.as("hasEarlier"))
      .where((eb) => {
        const filters: Expression<SqlBool>[] = [
          eb("sequenceId", "<", arg.beforeSequenceId),
          eb("topicId", "=", arg.topicId),
        ];
        if (arg.subscriptionStartSequenceId !== null) {
          filters.push(eb("sequenceId", ">=", arg.subscriptionStartSequenceId));
        }

        return eb.and(filters);
      })
      .executeTakeFirstOrThrow(),
    (e) => e
  ).map((v) => v.hasEarlier);
}

export function getGroupLastReadSequenceId(
  db: KyselyDB,
  arg: {
    userId: UserId;
    topicId: GroupTopicId;
    status:
      | {
          type: "in the group";
        }
      | {
          type: "removed from the group";
          topicEventLogId: number;
        };
  }
) {
  if (arg.status.type == "in the group") {
    return getLastReadSequenceId(db, {
      userId: arg.userId,
      topicId: arg.topicId,
    });
  }

  return fromPromise(
    db
      .selectFrom("topicEventLogMetaRemoveMember")
      .select("readSeqId as lastReadSeqId")
      .where("id", "=", arg.status.topicEventLogId)
      .executeTakeFirstOrThrow(),
    (e) => e
  ).map((v) => (v.lastReadSeqId === null ? 0 : v.lastReadSeqId));
}

export async function userStatusInTheGroup(
  db: KyselyDB,
  arg: {
    userId: UserId;
    topicId: GroupTopicId;
  }
): Promise<
  Result<
    | {
        type: "in the group";
      }
    | {
        type: "removed from the group";
        topicEventLogId: number;
      }
    | {
        type: "user is never in the group";
      },
    unknown
  >
> {
  // if user is removed, return the topic_event_log_id of the removal
  const subscriptionIdResult = await fromPromise(
    db
      .selectFrom("subscriptions")
      .select("id")
      .where("topicId", "=", arg.topicId)
      .where("userId", "=", arg.userId)
      .executeTakeFirst(),
    (e) => e
  );
  if (subscriptionIdResult.isErr()) {
    return err(subscriptionIdResult.error);
  }

  if (subscriptionIdResult.value !== undefined) {
    return ok({ type: "in the group" });
  }

  const topicEventLogIdResult = await fromPromise(
    db
      .selectFrom("topicEventLogs")
      .select("id")
      .where("topicId", "=", arg.topicId)
      .where(({ or, and, eb }) =>
        or([
          and([
            eb("topicEvent", "=", "remove_member"),
            eb("affectedUserId", "=", arg.userId),
          ]),
          and([
            eb("topicEvent", "=", "leave_group"),
            eb("actorUserId", "=", arg.userId),
          ]),
        ])
      )
      .orderBy("createdAt", "desc")
      .executeTakeFirst(),
    (e) => e
  );
  if (topicEventLogIdResult.isErr()) {
    return err(topicEventLogIdResult.error);
  }
  if (topicEventLogIdResult.value === undefined) {
    return err({ type: "user is never in the group" });
  }

  return ok({
    type: "removed from the group",
    topicEventLogId: topicEventLogIdResult.value.id,
  });
}

export function getGroupPeersLastReadSeqId(
  db: KyselyDB,
  arg: {
    requesterGroupMemberId: UserId;
    topicId: GroupTopicId;
  }
) {
  return fromPromise(
    db
      .selectFrom("subscriptions")
      .select("readSeqId")
      .where("topicId", "=", arg.topicId)
      .where(({ not, eb }) =>
        not(eb("userId", "=", arg.requesterGroupMemberId))
      )
      .orderBy((eb) => sql`${eb.ref("readSeqId")} DESC NULLS LAST`)
      .limit(1)
      .executeTakeFirst(),
    (e) => e
  ).map((v) => (v === undefined || v.readSeqId === null ? 0 : v.readSeqId));
}

export async function existMessage(
  db: KyselyDB,
  arg: {
    topicId: UserId | GroupTopicId;
    requesterUserId: UserId;
    messageSeqId: number;
    beforeSequenceId: number;
  }
) {
  let topicId: TopicId;

  if (IsUserId(arg.topicId)) {
    const topicIdResult = await getTopicIdOfP2PTopicBetween(db, {
      topicUser1: arg.requesterUserId,
      topicUser2: arg.topicId,
    });
    if (topicIdResult.isErr()) {
      return err({ type: "unknown" as const, cause: topicIdResult.error });
    }
    topicId = topicIdResult.value.topicId;
  } else {
    topicId = arg.topicId;
  }

  const messageIdResult = await fromPromise(
    db
      .selectFrom("messages")
      .select("id")
      .where("topicId", "=", topicId)
      .where("sequenceId", "=", arg.messageSeqId)
      .where("sequenceId", "<=", arg.beforeSequenceId)
      .executeTakeFirst(),
    (e) => e
  );
  if (messageIdResult.isErr()) {
    return err({ type: "unknown" as const, cause: messageIdResult.error });
  }
  if (messageIdResult.value === undefined) {
    return ok(false);
  }

  const messageId = messageIdResult.value.id;

  const messageDeleteLog = await fromPromise(
    db
      .selectFrom("messageDeleteLogs")
      .select("id")
      .where("messageId", "=", messageId)
      .where("deletedFor", "=", "self")
      .where("deletedBy", "=", arg.requesterUserId)
      .executeTakeFirst(),
    (e) => e
  );
  if (messageDeleteLog.isErr()) {
    return err({
      type: "unknown" as const,
      cause: messageDeleteLog.error,
    });
  }

  return ok(messageDeleteLog.value === undefined);
}

export function getFullnameOfUsers(db: KyselyDB, ids: UserId[]) {
  if (ids.length == 0) {
    return okAsync([]);
  }
  return fromPromise(
    db
      .selectFrom("users")
      .select(["id", "fullname"])
      .where("id", "in", ids)
      .execute(),
    (e) => e
  );
}

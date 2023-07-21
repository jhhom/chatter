import { AppPgDatabase, AppPgTransaction } from "~/backend/drizzle/db";
import {
  GroupTopicId,
  users,
  topics,
  topicEventLogs,
  messageDeleteLogs,
  subscriptions,
  messages,
  topicEventLogMetaRemoveMember,
  TopicId,
  UserId,
  TopicEventType,
} from "~/backend/drizzle/schema";
import { fromPromise } from "neverthrow";
import {
  eq,
  and,
  lt,
  desc,
  inArray,
  not,
  SQL,
  sql,
  gte,
  lte,
  or,
} from "drizzle-orm";
import { err, ok, okAsync, errAsync } from "neverthrow";
import { alias } from "drizzle-orm/pg-core";
import type { Message } from "~/backend/drizzle/message-type";
import { MessageContent } from "~/api-contract/subscription/subscription";
import { IsUserId } from "~/backend/service/common/topics";

export function getTopicIdOfP2PTopicBetween(
  db: AppPgDatabase,
  args: {
    topicUser1: UserId;
    topicUser2: UserId;
  }
) {
  const subscriber1 = alias(subscriptions, "sub1");
  const subscriber2 = alias(subscriptions, "sub2");

  // 1. Get the topic id
  return fromPromise(
    db
      .select({ id: topics.id })
      .from(topics)
      .where(
        and(
          eq(subscriber1.userId, args.topicUser1),
          eq(subscriber2.userId, args.topicUser2),
          eq(topics.topicType, "p2p")
        )
      )
      .innerJoin(subscriber1, eq(subscriber1.topicId, topics.id))
      .innerJoin(subscriber2, eq(subscriber2.topicId, topics.id)),
    (e) => ({ type: "database", cause: e } as const)
  ).andThen((v) => {
    if (v.length == 0) {
      return errAsync({ type: "topic not exist" } as const);
    }
    return okAsync({ topicId: v[0].id });
  });
}

export async function getFullnameOfUsers(db: AppPgDatabase, ids: UserId[]) {
  if (ids.length == 0) {
    return ok([]);
  }

  const result = await fromPromise(
    db
      .select({ id: users.id, fullname: users.fullname })
      .from(users)
      .where(inArray(users.id, ids)),
    (e) => e
  );
  return result;
}

export function getSubscribersOfTopic(
  db: AppPgDatabase,
  arg: {
    topicId: GroupTopicId;
  }
) {
  return fromPromise(
    db
      .select({
        subscriberId: subscriptions.userId,
        subscriberName: users.fullname,
      })
      .from(subscriptions)
      .leftJoin(users, eq(users.id, subscriptions.userId))
      .where(eq(subscriptions.topicId, arg.topicId)),
    (e) => e
  );
}

export async function getPrecedingMessageDate(
  db: AppPgDatabase | AppPgTransaction,
  arg: {
    topicId: TopicId;
    beforeSequenceId: number;
  }
) {
  let precedingMessageDate: Date | undefined;

  const precedingMsgResult = await fromPromise(
    db
      .select({ createdAt: messages.createdAt })
      .from(messages)
      .where(
        and(
          eq(messages.topicId, arg.topicId),
          lt(messages.sequenceId, arg.beforeSequenceId)
        )
      )
      .limit(1)
      .orderBy(desc(messages.sequenceId)),
    (e) => e
  );
  if (precedingMsgResult.isErr()) {
    return err(precedingMsgResult.error);
  }
  if (precedingMsgResult.value.length != 0) {
    precedingMessageDate = new Date(precedingMsgResult.value[0].createdAt);
  }
  return ok(precedingMessageDate);
}

export type MessagesResultEventLogs = {
  type: "event_log";
  event: TopicEventType;
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

export async function getGroupMembers(
  ctx: { db: AppPgDatabase },
  input: { groupTopicId: GroupTopicId }
) {
  return fromPromise(
    ctx.db
      .select({
        id: users.id,
        username: users.username,
        fullname: users.fullname,
        profilePhotoUrl: users.profilePhotoUrl,
      })
      .from(subscriptions)
      .innerJoin(users, eq(users.id, subscriptions.userId))
      .where(eq(subscriptions.topicId, input.groupTopicId)),
    (e) => e
  );
}

export function getPermissionInP2PTopic(
  db: AppPgDatabase,
  arg: {
    peer1: UserId;
    peer2: UserId;
    /**
     * If this is peer1, it will return the permission of `arg.peer1`
     * And vice-versa for `peer2`
     *
     * */
    permissionRequested: "peer1" | "peer2";
  }
) {
  const peer1 = alias(subscriptions, "peer1");
  const peer2 = alias(subscriptions, "peer2");

  const select =
    arg.permissionRequested == "peer1" ? peer1.permissions : peer2.permissions;

  return fromPromise(
    db
      .select({ permissions: select })
      .from(topics)
      .where(
        and(
          eq(topics.topicType, "p2p"),
          eq(topics.id, peer1.topicId),
          eq(topics.id, peer2.topicId)
        )
      )
      .innerJoin(
        peer2,
        and(eq(peer2.userId, arg.peer2), not(eq(peer2.userId, arg.peer1)))
      )
      .innerJoin(
        peer1,
        and(eq(peer1.userId, arg.peer1), not(eq(peer1.userId, arg.peer2)))
      ),
    (e) =>
      ({
        type: "Database error",
        cause: e,
      } as const)
  ).andThen((v) => {
    if (v.length == 0) {
      return errAsync({ type: "No topic found" } as const);
    }
    return okAsync(v[0]!);
  });
}

export async function userStatusInTheGroup(
  db: AppPgDatabase,
  arg: {
    userId: UserId;
    topicId: GroupTopicId;
  }
) {
  // if user is removed, return the topic_event_log_id of the removal
  const subscriptionIdResult = await fromPromise(
    db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.topicId, arg.topicId),
          eq(subscriptions.userId, arg.userId)
        )
      ),
    (e) => e
  );
  if (subscriptionIdResult.isErr()) {
    return err(subscriptionIdResult.error);
  }
  if (subscriptionIdResult.value.length != 0) {
    return ok({ type: "in the group" } as const);
  }

  const topicEventLogIdResult = await fromPromise(
    db
      .select({ id: topicEventLogs.id })
      .from(topicEventLogs)
      .where(
        and(
          eq(topicEventLogs.topicId, arg.topicId),
          or(
            and(
              eq(topicEventLogs.topicEvent, "remove_member"),
              eq(topicEventLogs.affectedUserId, arg.userId)
            ),
            and(
              eq(topicEventLogs.topicEvent, "leave_group"),
              eq(topicEventLogs.actorUserId, arg.userId)
            )
          )
        )
      )
      .orderBy(desc(topicEventLogs.createdAt)),
    (e) => e
  );
  if (topicEventLogIdResult.isErr()) {
    return err(topicEventLogIdResult.error);
  }
  if (topicEventLogIdResult.value.length == 0) {
    return err({
      type: "user is never in the group" as const,
    });
  }
  const topicEventLogId = topicEventLogIdResult.value[0].id;

  return ok({
    type: "removed from the group" as const,
    topicEventLogId,
  });
}

export async function getP2PTopicProfile(
  tx: AppPgTransaction | AppPgDatabase,
  arg: {
    user1Id: UserId;
    user2Id: UserId;
  }
) {
  const user1Sub = alias(subscriptions, "user1_sub");
  const user2Sub = alias(subscriptions, "user2_sub");
  const user1 = alias(users, "user1");
  const user2 = alias(users, "user2");

  return fromPromise(
    tx
      .select({
        user1Name: user1.fullname,
        user1ProfilePhotoUrl: user1.profilePhotoUrl,
        user1Permissions: user1Sub.permissions,
        user2Name: user2.fullname,
        user2ProfilePhotoUrl: user2.profilePhotoUrl,
        user2Permissions: user2Sub.permissions,
      })
      .from(topics)
      .where(
        and(
          eq(topics.topicType, "p2p"),
          eq(topics.id, user1Sub.topicId),
          eq(topics.id, user2Sub.topicId)
        )
      )
      .innerJoin(user1, eq(user1.id, arg.user1Id))
      .innerJoin(user2, eq(user2.id, arg.user2Id))
      .innerJoin(
        user1Sub,
        and(
          eq(user1Sub.userId, arg.user1Id),
          not(eq(user1Sub.userId, arg.user2Id))
        )
      )
      .innerJoin(
        user2Sub,
        and(
          eq(user2Sub.userId, arg.user2Id),
          not(eq(user2Sub.userId, arg.user1Id))
        )
      ),
    (e) => e
  ).andThen((v) => {
    if (v.length == 0) {
      return err("No topic found");
    }
    return ok(v[0]);
  });
}

export function getGroupLastReadSequenceId(
  db: AppPgDatabase,
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
    return getLastReadSequenceId(db, arg.userId, arg.topicId);
  }
  return fromPromise(
    db
      .select({ lastReadSeqId: topicEventLogMetaRemoveMember.readSeqId })
      .from(topicEventLogMetaRemoveMember)
      .where(
        and(eq(topicEventLogMetaRemoveMember.id, arg.status.topicEventLogId))
      ),
    (e) => e
  ).andThen((v) => {
    if (v.length == 0) {
      return errAsync(new Error("no last read sequence returned"));
    }
    return okAsync(v[0].lastReadSeqId ?? 0);
  });
}

export function getLastReadSequenceId(
  db: AppPgDatabase,
  userId: UserId,
  topicId: TopicId
) {
  return fromPromise(
    db
      .select({ lastReadSeqId: subscriptions.readSeqId })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, userId),
          eq(subscriptions.topicId, topicId)
        )
      ),
    (e) => e
  ).andThen((v) => {
    if (v.length == 0) {
      return errAsync(new Error("no last read sequence returned"));
    }
    return okAsync(v[0].lastReadSeqId ?? 0);
  });
}

export function hasMessagesEarlierThan(
  db: AppPgDatabase,
  arg: {
    topicId: TopicId;
    beforeSequenceId: number;
    subscriptionStartSequenceId: number | null;
  }
) {
  let filters: SQL<unknown>[] = [
    lt(messages.sequenceId, arg.beforeSequenceId),
    eq(messages.topicId, arg.topicId),
  ];
  if (arg.subscriptionStartSequenceId != null) {
    filters.push(gte(messages.sequenceId, arg.subscriptionStartSequenceId));
  }

  return fromPromise(
    db
      .select({ hasEarlier: sql`COUNT(id) > 0` })
      .from(messages)
      .where(and(...filters))
      .limit(1),
    (e) => e
  ).map((v) => v.length > 0 && (v[0].hasEarlier as boolean));
}

export async function existMessage(
  db: AppPgDatabase,
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
    db.query.messages.findFirst({
      columns: { id: true },
      where: and(
        eq(messages.topicId, topicId),
        eq(messages.sequenceId, arg.messageSeqId),
        lte(messages.sequenceId, arg.beforeSequenceId)
      ),
    }),
    (e) => e
  );
  if (messageIdResult.isErr()) {
    return err({ type: "unknown" as const, cause: messageIdResult.error });
  }
  if (messageIdResult.value === undefined) {
    return ok(false);
  }

  const messageId = messageIdResult.value.id;

  const messageDeleteLogIdResult = await fromPromise(
    db
      .select({ id: messageDeleteLogs.id })
      .from(messageDeleteLogs)
      .where(
        and(
          eq(messageDeleteLogs.messageId, messageId),
          eq(messageDeleteLogs.deletedFor, "self"),
          eq(messageDeleteLogs.deletedBy, arg.requesterUserId)
        )
      ),
    (e) => e
  );
  if (messageDeleteLogIdResult.isErr()) {
    return err({
      type: "unknown" as const,
      cause: messageDeleteLogIdResult.error,
    });
  }

  if (messageDeleteLogIdResult.value.length !== 0) {
    return ok(false);
  }

  return ok(true);
}

export function updateUserLastOnline(
  db: AppPgDatabase,
  arg: {
    userId: UserId;
    lastOnline: Date | null;
  }
) {
  return fromPromise(
    db
      .update(users)
      .set({
        lastOnline:
          arg.lastOnline === null ? null : arg.lastOnline.toISOString(),
      })
      .where(eq(users.id, arg.userId)),
    (e) => e
  );
}

export async function existUser(db: AppPgDatabase, userId: UserId) {
  const r = await fromPromise(
    db.select({ id: users.id }).from(users).where(eq(users.id, userId)),
    (e) => e
  );
  if (r.isErr()) {
    return err(r.error);
  }
  return ok(r.value.length > 0);
}

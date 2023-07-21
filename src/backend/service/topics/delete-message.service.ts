import { fromPromise, ok, err } from "neverthrow";
import { OnlineUsers } from "~/backend/service/common/online-users";
import { KyselyDB, MessageDeletedFor } from "~/backend/schema";

import {
  getTopicIdOfP2PTopicBetween,
  getSubscribersOfTopic,
} from "~/backend/service/topics/common/repo/repo";
import { IsUserId } from "~/backend/service/common/topics";

import {
  TopicId,
  UserId,
  GroupTopicId,
} from "~/api-contract/subscription/subscription";
import { AppError } from "~/api-contract/errors/errors";

export async function deleteMessage(
  ctx: { db: KyselyDB; onlineUsers: OnlineUsers },
  arg: {
    deleterUserId: UserId;
    topicId: UserId | GroupTopicId;
    messageSeqId: number;
    deleteFor: MessageDeletedFor;
  }
) /*: ServiceResult<"topic/delete_message"> */ {
  let topicId: TopicId;

  if (IsUserId(arg.topicId)) {
    const topicIdResult = await getTopicIdOfP2PTopicBetween(ctx.db, {
      topicUser1: arg.topicId,
      topicUser2: arg.deleterUserId,
    });
    if (topicIdResult.isErr()) {
      return err(new AppError("UNKNOWN", { cause: topicIdResult.error }));
    }
    topicId = topicIdResult.value.topicId;
  } else {
    topicId = arg.topicId;
  }

  const messageResult = await fromPromise(
    ctx.db
      .selectFrom("messages")
      .select("id")
      .where("messages.sequenceId", "=", arg.messageSeqId)
      .where("messages.topicId", "=", topicId)
      .executeTakeFirstOrThrow(),
    (e) => e
  );
  if (messageResult.isErr() || messageResult.value === undefined) {
    return err(
      new AppError("RESOURCE_NOT_FOUND", { resource: "message to be deleted" })
    );
  }
  const messageId = messageResult.value.id;

  const r = await fromPromise(
    ctx.db
      .insertInto("messageDeleteLogs")
      .values({
        messageId,
        deletedBy: arg.deleterUserId,
        deletedFor: arg.deleteFor,
      })
      .execute(),
    (e) => new AppError("DATABASE", { cause: e })
  );
  if (r.isErr()) {
    return err(r.error);
  }

  // notify all subscribers of the topic that message is delted
  if (IsUserId(arg.topicId)) {
    const user = ctx.onlineUsers.get(arg.deleterUserId);
    if (user) {
      user.sockets.next({
        event: "notification.message-deleted",
        payload: {
          topicId: arg.topicId,
          seqId: arg.messageSeqId,
          deletedFor: arg.deleteFor,
        },
      });
    }
    if (arg.deleteFor == "everyone") {
      const user = ctx.onlineUsers.get(arg.topicId);
      if (user) {
        user.sockets.next({
          event: "notification.message-deleted",
          payload: {
            topicId: arg.deleterUserId,
            seqId: arg.messageSeqId,
            deletedFor: arg.deleteFor,
          },
        });
      }
    }
  } else {
    if (arg.deleteFor == "everyone") {
      const subscribers = await getSubscribersOfTopic(ctx.db, arg.topicId);
      if (subscribers.isErr()) {
        return err(new AppError("UNKNOWN", { cause: subscribers.error }));
      }

      for (const s of subscribers.value) {
        const user = ctx.onlineUsers.get(s.subscriberId);
        if (user) {
          user.sockets.next({
            event: "notification.message-deleted",
            payload: {
              topicId: arg.topicId,
              seqId: arg.messageSeqId,
              deletedFor: arg.deleteFor,
            },
          });
        }
      }
    } else {
      const user = ctx.onlineUsers.get(arg.deleterUserId);
      if (user) {
        user.sockets.next({
          event: "notification.message-deleted",
          payload: {
            topicId: arg.topicId,
            seqId: arg.messageSeqId,
            deletedFor: arg.deleteFor,
          },
        });
      }
    }
  }

  return r;
}

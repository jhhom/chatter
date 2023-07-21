import { err, ok, fromPromise } from "neverthrow";
import { match } from "ts-pattern";

import { AppPgDatabase } from "~/backend/drizzle/db";
import {
  GroupTopicId,
  UserId,
  messageReplyLogs,
} from "~/backend/drizzle/schema";
import { OnlineUsers } from "~/backend/service/common/online-users";
import { MessageInput } from "~/backend/service/topics/use-cases/send-message/schema";
import { addMessageToTopic } from "~/backend/service/topics/use-cases/send-message/send-message.repository";
import { IsUserId } from "~/backend/service/common/topics";
import { getSubscribersOfTopic } from "~/backend/service/topics/common/repo";
import { completeMediaUrl } from "~/backend/service/topics/use-cases/send-message/media";

import { getMessage } from "./reply-message.repository";
import { ServiceResult } from "~/api-contract/types";
import { AppError } from "~/api-contract/errors/errors";

export async function replyMessage(
  ctx: {
    db: AppPgDatabase;
    currentOnlineUsers: OnlineUsers;
  },
  arg: {
    content: MessageInput;
    topicId: UserId | GroupTopicId;
    authorId: UserId;
    replyToMessageSeqId: number;
  },
  config: {
    projectRoot: string;
  }
): ServiceResult<"topic/reply_message"> {
  // The flow of replying to a message
  // ---------------------------------------------------------
  // 1. Get the message id of the message being replied to
  // 2. Add the new message to the topic
  // 3. Create a message reply log
  // 4. Notify the subscriber to the topic of the reply

  // 1. ⭐️ Get the message id of the message being replied to
  const replyToMessageResult = await getMessage(ctx.db, {
    topicId: arg.topicId,
    requesterUserId: arg.authorId,
    messageSeqId: arg.replyToMessageSeqId,
  });
  if (replyToMessageResult.isErr()) {
    return err(new AppError("UNKNOWN", { cause: replyToMessageResult.error }));
  }
  if (replyToMessageResult.value === undefined) {
    return err(
      new AppError("RESOURCE_NOT_FOUND", { resource: "message to reply to" })
    );
  }
  const replyToMessageId = replyToMessageResult.value.id;

  const r = await fromPromise(
    ctx.db.transaction(async (tx) => {
      // 2. ⭐️ Add the new message to the topic
      const messageAddResult = await addMessageToTopic(
        tx,
        {
          content: arg.content,
          author: arg.authorId,
          sentTo: arg.topicId,
        },
        config
      );
      if (messageAddResult.isErr()) {
        throw messageAddResult.error;
      }

      // 3. ⭐️ Create a message reply log
      await tx.insert(messageReplyLogs).values({
        messageId: messageAddResult.value.message.id,
        replyToMessage: replyToMessageId,
      });

      return {
        message: messageAddResult.value.message,
      };
    }),
    (e) => e
  );
  if (r.isErr()) {
    return err(new AppError("UNKNOWN", { cause: r.error }));
  }

  if (
    replyToMessageResult.value.content !== null &&
    replyToMessageResult.value.content.type == "picture"
  ) {
    replyToMessageResult.value.content.url = completeMediaUrl(
      replyToMessageResult.value.content.url
    );
  }

  // 2. ⭐️ Notify user of the message, if they are online (if topic is P2P)
  if (IsUserId(arg.topicId)) {
    const user = ctx.currentOnlineUsers.get(arg.topicId);
    if (user) {
      user.sockets.next({
        event: "message",
        payload: {
          topicId: arg.authorId,
          content: {
            ...r.value.message.content,
            replyTo: {
              ...replyToMessageResult.value.content!,
              authorId: replyToMessageResult.value.authorId!,
              seqId: arg.replyToMessageSeqId,
            },
          },
          seqId: r.value.message.sequenceId,
          authorId: r.value.message.authorId,
          createdAt: new Date(r.value.message.createdAt),
          isFirstOfDate: r.value.message.isFirstOfDate,
          lastMessageContent: null,
        },
      });
    }
    const author = ctx.currentOnlineUsers.get(arg.authorId);
    if (author) {
      author.sockets.next({
        event: "message",
        payload: {
          topicId: arg.topicId,
          content: {
            ...r.value.message.content,
            replyTo: {
              ...replyToMessageResult.value.content!,
              authorId: replyToMessageResult.value.authorId!,
              seqId: arg.replyToMessageSeqId,
            },
          },
          seqId: r.value.message.sequenceId,
          authorId: r.value.message.authorId,
          createdAt: new Date(r.value.message.createdAt),
          isFirstOfDate: r.value.message.isFirstOfDate,
          lastMessageContent: null,
        },
      });
    }
  } else {
    // 3. ⭐️ Notify group members of the message, if they are online (if topic is Group)
    const subscribersResult = await getSubscribersOfTopic(ctx.db, {
      topicId: arg.topicId,
    });
    if (subscribersResult.isErr()) {
      return err(new AppError("UNKNOWN", { cause: subscribersResult.error }));
    }

    const authorName =
      subscribersResult.value.find((s) => s.subscriberId === arg.authorId)
        ?.subscriberName ?? "";

    for (const { subscriberId } of subscribersResult.value) {
      const user = ctx.currentOnlineUsers.get(subscriberId);

      const author = subscriberId === arg.authorId ? "You" : authorName;

      if (user) {
        user.sockets.next({
          event: "message",
          payload: {
            topicId: arg.topicId,
            content: {
              ...r.value.message.content,
              replyTo: {
                ...replyToMessageResult.value.content!,
                authorId: replyToMessageResult.value.authorId!,
                seqId: arg.replyToMessageSeqId,
              },
            },
            seqId: r.value.message.sequenceId,
            authorId: r.value.message.authorId,
            createdAt: new Date(r.value.message.createdAt),
            isFirstOfDate: r.value.message.isFirstOfDate,
            lastMessageContent: match(r.value.message.content!)
              .with({ type: "text" }, (c) => c.content)
              .with({ type: "picture" }, (c) => `${author} sent a picture`)
              .with({ type: "file" }, (c) => `${author} sent a file`)
              .exhaustive(),
          },
        });
      }
    }
  }

  return ok({});
}

import { ok, err } from "neverthrow";
import { match } from "ts-pattern";

import { getSubscribersOfTopic } from "~/backend/service/topics/common/repo";
import { OnlineUsers } from "~/backend/service/common/online-users";
import { AppPgDatabase } from "~/backend/drizzle/db";
import { GroupTopicId, UserId } from "~/backend/drizzle/schema";
import { IsUserId } from "~/backend/service/common/topics";

import { MessageInput } from "./schema";
import { addMessageToTopic } from "./send-message.repository";
import { permission } from "~/backend/common/permissions";

import { ServiceResult } from "~/api-contract/types";
import { AppError } from "~/api-contract/errors/errors";

export async function sendMessage(
  ctx: {
    db: AppPgDatabase;
    currentOnlineUsers: OnlineUsers;
  },
  arg: {
    content: MessageInput;
    topicId: UserId | GroupTopicId;
    authorId: UserId;
  },
  config: {
    projectRoot: string;
  }
): ServiceResult<"topic/send_message"> {
  // The flow of a user sending a message to a topic
  // ------------------------------------------------
  // 1. Save the message into database
  // 2. Notify user of the message, if they are online (if topic is P2P)
  // 3. Notify group members of the message, if they are online (if topic is Group)
  // 4. If the sending of the message result in the creation of a new P2P topic, return the profile of the topic which includes the name, description, permissions to the sender

  // 1. ⭐️ Save the message into database
  const result = await addMessageToTopic(
    ctx.db,
    {
      content: arg.content,
      author: arg.authorId,
      sentTo: arg.topicId,
    },
    config
  );
  if (result.isErr()) {
    return err(new AppError("UNKNOWN", { cause: result.error }));
  }
  const message = result.value.message;

  // 2. ⭐️ Notify user of the message, if they are online (if topic is P2P)
  if (IsUserId(arg.topicId)) {
    const receiver = ctx.currentOnlineUsers.get(arg.topicId);
    if (receiver) {
      if (result.value.type == "peer.new-topic") {
        receiver.sockets.next({
          event: "message.from-new-topic",
          payload: {
            topicId: arg.authorId,
            content: {
              ...message.content,
              replyTo: null,
            },
            seqId: message.sequenceId,
            authorId: message.authorId,
            topic: {
              userId: arg.authorId,
              name: result.value.createdTopicProfile.authorProfile.name,
              touchedAt: new Date(message.createdAt),
              profilePhotoUrl:
                result.value.createdTopicProfile.authorProfile.profilePhotoUrl,
              userPermissions:
                result.value.createdTopicProfile.receiverProfile.permissions,
              peerPermissions:
                result.value.createdTopicProfile.authorProfile.permissions,
              online: permission(
                result.value.createdTopicProfile.receiverProfile.permissions
              ).canGetNotifiedOfPresence()
                ? ctx.currentOnlineUsers.isUserOnline(arg.authorId)
                : false,
            },
            createdAt: new Date(message.createdAt),
            isFirstOfDate: message.isFirstOfDate,
          },
        });
      } else {
        receiver.sockets.next({
          event: "message",
          payload: {
            topicId: arg.authorId,
            content: {
              ...message.content,
              replyTo: null,
            },
            seqId: message.sequenceId,
            authorId: message.authorId,
            createdAt: new Date(message.createdAt),
            isFirstOfDate: message.isFirstOfDate,
            lastMessageContent: null,
          },
        });
      }
    }
    const author = ctx.currentOnlineUsers.get(arg.authorId);
    if (author) {
      if (result.value.type == "peer.new-topic") {
        author.sockets.next({
          event: "message.from-new-topic",
          payload: {
            topicId: arg.topicId,
            content: {
              ...message.content,
              replyTo: null,
            },
            seqId: message.sequenceId,
            authorId: message.authorId,
            topic: {
              userId: arg.topicId,
              name: result.value.createdTopicProfile.receiverProfile.name,
              touchedAt: new Date(message.createdAt),
              profilePhotoUrl:
                result.value.createdTopicProfile.receiverProfile
                  .profilePhotoUrl,
              userPermissions:
                result.value.createdTopicProfile.authorProfile.permissions,
              peerPermissions:
                result.value.createdTopicProfile.receiverProfile.permissions,
              online: permission(
                result.value.createdTopicProfile.authorProfile.permissions
              ).canGetNotifiedOfPresence()
                ? ctx.currentOnlineUsers.isUserOnline(arg.topicId)
                : false,
            },
            createdAt: new Date(message.createdAt),
            isFirstOfDate: message.isFirstOfDate,
          },
        });
      } else {
        author.sockets.next({
          event: "message",
          payload: {
            topicId: arg.topicId,
            content: {
              ...message.content,
              replyTo: null,
            },
            seqId: message.sequenceId,
            authorId: message.authorId,
            createdAt: new Date(message.createdAt),
            isFirstOfDate: message.isFirstOfDate,
            lastMessageContent: null,
          },
        });
      }
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
      subscribersResult.value.find((s) => s.subscriberId === message.authorId)
        ?.subscriberName ?? "";

    for (const { subscriberId } of subscribersResult.value) {
      const user = ctx.currentOnlineUsers.get(subscriberId);

      const author = subscriberId === message.authorId ? "You" : authorName;

      if (user) {
        user.sockets.next({
          event: "message",
          payload: {
            topicId: arg.topicId,
            content: {
              ...message.content,
              replyTo: null,
            },
            seqId: message.sequenceId,
            authorId: message.authorId,
            createdAt: new Date(message.createdAt),
            isFirstOfDate: message.isFirstOfDate,
            lastMessageContent: match(message.content)
              .with({ type: "file" }, () => `${author} sent a file`)
              .with({ type: "picture" }, () => `${author} sent a picture`)
              .with({ type: "text" }, (c) => c.content)
              .exhaustive(),
          },
        });
      }
    }
  }

  // 4. ⭐️ If the sending of the message result in the creation of a new P2P topic, return the profile of the topic which includes the name, description, permissions to the sender
  if (result.value.type == "peer.new-topic") {
    return ok({});
  }

  return ok({});
}

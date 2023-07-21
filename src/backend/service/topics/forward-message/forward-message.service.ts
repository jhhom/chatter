import { fromPromise, err, ok } from "neverthrow";
import { match } from "ts-pattern";
import { OnlineUsers } from "~/backend/service/common/online-users";
import { KyselyDB } from "~/backend/schema";
import { UserId, GroupTopicId } from "~/api-contract/subscription/subscription";

import { getSubscribersOfTopic } from "~/backend/service/topics/common/repo/repo";
import { addMessageToP2PTopic } from "~/backend/service/topics/forward-message/add-message-to-p2p.repository";
import { addMessageToGroupTopic } from "~/backend/service/topics/forward-message/add-message-to-group.repository";
import { findMessage } from "~/backend/service/topics/forward-message/forward-message.repository";
import { AppError } from "~/api-contract/errors/errors";

import { IsUserId } from "~/backend/service/common/topics";

export async function forwardMessage(
  { db, onlineUsers }: { db: KyselyDB; onlineUsers: OnlineUsers },
  arg: {
    forwarder: UserId;
    forwardedMessage: {
      seqId: number;
      topicId: UserId | GroupTopicId;
    };
    forwardedTo: UserId | GroupTopicId;
  }
) {
  const message = await findMessage(db, {
    ...arg.forwardedMessage,
    requesterUserId: arg.forwarder,
  });
  if (message.isErr()) {
    return err(message.error);
  }

  if (IsUserId(arg.forwardedTo)) {
    const msg = await addMessageToP2PTopic(db, {
      message: message.value,
      forwarder: arg.forwarder,
      forwardedTo: arg.forwardedTo,
    });
    if (msg.isErr()) {
      return err(new AppError("UNKNOWN", { cause: msg.error }));
    }

    const user = onlineUsers.get(arg.forwardedTo);
    if (user) {
      user.sockets.next({
        event: "message",
        payload: {
          topicId: arg.forwarder,
          content: {
            ...msg.value.message.content!,
            replyTo: null,
          },
          seqId: msg.value.message.sequenceId,
          authorId: msg.value.message.authorId,
          createdAt: new Date(msg.value.message.createdAt),
          isFirstOfDate: msg.value.message.isFirstOfDate,
          lastMessageContent: null,
        },
      });
    }

    const author = onlineUsers.get(arg.forwarder);
    if (author) {
      author.sockets.next({
        event: "message",
        payload: {
          topicId: arg.forwardedTo,
          content: {
            ...msg.value.message.content!,
            replyTo: null,
          },
          seqId: msg.value.message.sequenceId,
          authorId: arg.forwarder,
          createdAt: new Date(msg.value.message.createdAt),
          isFirstOfDate: msg.value.message.isFirstOfDate,
          lastMessageContent: null,
        },
      });
    }

    if (msg.value.type == "peer.new-topic") {
      return ok({
        ...msg.value.message,
        content: {
          ...msg.value.message.content!,
          replyTo: null,
        },
        type: msg.value.type,
        createdTopicProfile: msg.value.createdTopicProfile,
        createdAt: new Date(msg.value.message.createdAt),
      });
    }
    return ok({});
  } else {
    const msg = await addMessageToGroupTopic(db, {
      message: message.value,
      forwarder: arg.forwarder,
      forwardedTo: arg.forwardedTo,
    });
    if (msg.isErr()) {
      return err(new AppError("UNKNOWN", { cause: msg.error }));
    }

    // 3. ⭐️ Notify group members of the message, if they are online (if topic is Group)
    const subscribersResult = await getSubscribersOfTopic(db, arg.forwardedTo);
    if (subscribersResult.isErr()) {
      return err(new AppError("UNKNOWN", { cause: subscribersResult.error }));
    }

    const authorName =
      subscribersResult.value.find((s) => s.subscriberId === arg.forwarder)
        ?.subscriberName ?? "";

    for (const { subscriberId } of subscribersResult.value) {
      const user = onlineUsers.get(subscriberId);

      const author = subscriberId === arg.forwarder ? "You" : authorName;

      if (user) {
        user.sockets.next({
          event: "message",
          payload: {
            topicId: arg.forwardedTo,
            content: {
              ...msg.value.message.content!,
              replyTo: null,
            },
            seqId: msg.value.message.sequenceId,
            authorId: msg.value.message.authorId,
            createdAt: new Date(msg.value.message.createdAt),
            isFirstOfDate: msg.value.message.isFirstOfDate,
            lastMessageContent: match(msg.value.message.content!)
              .with({ type: "text" }, (c) => c.content)
              .with({ type: "picture" }, (c) => `${author} sent a picture`)
              .with({ type: "file" }, (c) => `${author} sent a file`)
              .exhaustive(),
          },
        });
      }
    }
    return ok({});
  }
}

import { AppPgDatabase, AppPgTransaction } from "~/backend/drizzle/db";
import {
  messages,
  topics,
  subscriptions,
  type UserId,
  type TopicId,
  GroupTopicId,
  groupTopicMeta,
  users,
} from "~/backend/drizzle/schema";
import { ok, err, fromPromise } from "neverthrow";
import { PgColumn, alias } from "drizzle-orm/pg-core";
import { faker } from "@faker-js/faker";

import { InferModel, sql, not, eq, and, exists, desc } from "drizzle-orm";
import { IsUserId } from "~/backend/service/common/topics";
import {
  getPrecedingMessageDate,
  getP2PTopicProfile,
} from "~/backend/service/topics/common/repo";
import { getUserDefaultPermission } from "~/backend/service/topics/use-cases/permissions/permissions";

import type { MessageInput } from "./schema";
import { saveMessageMedia } from "./message-media";
import { completeMediaUrl } from "./media";

export async function addMessageToTopic(
  db: AppPgDatabase | AppPgTransaction,
  arg: {
    content: MessageInput;
    author: UserId;
    sentTo: UserId | GroupTopicId;
  },
  config: {
    projectRoot: string;
  }
) {
  /**
   * Flow of adding message to a topic
   *
   * 1. if it is sent to user id, we need to check if sub exist and create the sub, only then add the message
   * 2. if it is sent to group id, if topic or sub doesn't exist, then we need to error
   */

  if (IsUserId(arg.sentTo)) {
    const result = await addMessageToP2PTopic(
      db,
      {
        content: arg.content,
        author: arg.author,
        sentTo: arg.sentTo,
      },
      config
    );
    if (result.isErr()) {
      return err(result.error);
    }

    return ok({
      ...result.value,
      message: {
        ...result.value.message,
        content: result.value.message.content!,
      },
    });
  } else {
    const result = await addMessageToGroupTopic(
      db,
      {
        content: arg.content,
        author: arg.author,
        sentTo: arg.sentTo,
      },
      config
    );
    if (result.isErr()) {
      return err(result.error);
    }

    return ok({
      message: {
        ...result.value.message,
        content: result.value.message.content!,
      },
      type: "group" as const,
    });
  }
}

const addMessageToGroupTopic = async (
  db: AppPgDatabase,
  arg: {
    content: MessageInput;
    author: UserId;
    sentTo: GroupTopicId;
  },
  config: {
    projectRoot: string;
  }
) => {
  /**
   * Flow of adding a new message to a Group topic
   *
   * 1. Find out if the user has a subscription to the group, reject the request if the user doesn't
   * 2. Save the media of the message (if the message includes any media)
   * 3. Determine if the message is the first message of the date, by getting the date of the preceding message
   * 4. If message sent includes any media, complete the media URL
   */

  // 1. ⭐️ Find out if the user has a subscription to the group, reject the request if the user doesn't
  const existSubscriptionResult = await fromPromise(
    db
      .select({
        exist: exists(
          db.select().from(subscriptions).where(eq(topics.id, arg.sentTo))
        ),
      })
      .from(topics),
    (e) => e
  ).map((v) => {
    if (v.length == 0) {
      return ok(false);
    }
    return ok(v[0].exist as boolean);
  });
  if (existSubscriptionResult.isErr()) {
    return err(existSubscriptionResult.error);
  }
  const existSubscription = existSubscriptionResult.value;

  if (!existSubscription) {
    return err(new Error("User is not subscribed to the topic"));
  }

  // 2. ⭐️ Save the media of the message (if the message includes any media)
  const msgSaveMediaResult = await saveMessageMedia(arg.content, config);
  if (msgSaveMediaResult.isErr()) {
    return err(msgSaveMediaResult.error);
  }
  const msg = msgSaveMediaResult.value;

  const messageResult = await fromPromise(
    db
      .insert(messages)
      .values({
        content: msg,
        topicId: arg.sentTo,
        authorId: arg.author,
      })
      .returning(),
    (e) => e
  );

  if (messageResult.isErr()) {
    return err(messageResult.error);
  }

  if (messageResult.value.length == 0) {
    return err("No result from created message");
  }

  // 3. ⭐️ Determine if the message is the first message of the date, by getting the date of the preceding message
  const precedingMessageDate = await getPrecedingMessageDate(db, {
    topicId: arg.sentTo,
    beforeSequenceId: messageResult.value[0].sequenceId,
  });
  if (precedingMessageDate.isErr()) {
    return err("Failed to get preceding message");
  }
  const precedingDate = precedingMessageDate.value;

  const message = messageResult.value[0];

  // 4. ⭐️ If message sent includes any media, complete the media URL
  if (message.content?.type == "picture" || message.content?.type == "file") {
    message.content.url = completeMediaUrl(message.content.url);
  }

  return ok({
    message: {
      ...message,
      authorId: message.authorId as UserId,
      isFirstOfDate:
        precedingDate == undefined
          ? true
          : precedingDate.toDateString() !=
            new Date(message.createdAt).toDateString(),
    },
  });
};

const addMessageToP2PTopic = async (
  db: AppPgDatabase,
  arg: {
    content: MessageInput;
    author: UserId;
    sentTo: UserId;
  },
  config: {
    projectRoot: string;
  }
) => {
  /**
   * Flow of adding a new message to a P2P topic
   *
   * 1. Find the topic between the author and sentTo person
   * 2. If topic doesn't exist, create it, and create the subscription for the 2 person
   * 3. Save the media of the message (if the message includes any media)
   * 4. Determine if the message is the first message of the date, by getting the date of the preceding message
   * 5. If message sent includes any media, complete the media URL
   * 6. If the sending of the message results in the creation of a new topic, return the information of the created topic
   */
  const subscriber1 = alias(subscriptions, "sub1");
  const subscriber2 = alias(subscriptions, "sub2");

  // 1. ⭐️ Find the topic between the author and sentTo person
  const existingTopicId = await fromPromise(
    db
      .select({ id: topics.id })
      .from(topics)
      .where(
        and(
          eq(subscriber1.userId, arg.author),
          eq(subscriber2.userId, arg.sentTo),
          eq(topics.topicType, "p2p")
        )
      )
      .innerJoin(subscriber1, eq(subscriber1.topicId, topics.id))
      .innerJoin(subscriber2, eq(subscriber2.topicId, topics.id)),
    (e) => e
  );
  if (existingTopicId.isErr()) {
    return err(existingTopicId.error);
  }

  let topicId: TopicId;

  const messageResult = await db.transaction(async (tx) => {
    const run = async () => {
      // 2. ⭐️ If topic doesn't exist, create it, and create the subscription for the 2 person
      if (existingTopicId.value.length == 0) {
        const createTopicResult = await fromPromise(
          tx
            .insert(topics)
            .values({
              id: `p2p${faker.random.alphaNumeric(12)}`,
              topicType: "p2p",
            })
            .returning({ id: topics.id }),
          (e) => e
        ).andThen((v) => {
          if (v.length == 0) {
            return err(new Error("no result returned from creating topic"));
          }
          return ok(v[0]);
        });
        if (createTopicResult.isErr()) {
          return err({
            type: "failed to create topic",
            cause: createTopicResult.error,
          });
        }
        topicId = createTopicResult.value.id;

        const sentToDefaultPermission = await getUserDefaultPermission(tx, {
          userId: arg.sentTo,
        });
        if (sentToDefaultPermission.isErr()) {
          return err(sentToDefaultPermission.error);
        }

        // create subscription for those topics
        // create a subscription for tha ttopic
        const subscriptionCreateResult = await fromPromise(
          tx.insert(subscriptions).values(
            [
              { userId: arg.sentTo, permission: "JRWP" },
              {
                userId: arg.author,
                permission: sentToDefaultPermission.value.defaultPermissions,
              },
            ].map((v) => ({
              topicId,
              userId: v.userId,
              permissions: v.permission,
            }))
          ),
          (e) => e
        );
        if (subscriptionCreateResult.isErr()) {
          return err(subscriptionCreateResult.error);
        }
      } else {
        topicId = existingTopicId.value[0].id;
      }

      // 3. ⭐️ Save the media of the message (if the message includes any media)
      const msgSaveMediaResult = await saveMessageMedia(arg.content, config);
      if (msgSaveMediaResult.isErr()) {
        return err(msgSaveMediaResult.error);
      }
      const msg = msgSaveMediaResult.value;

      const messageResult = await fromPromise(
        tx
          .insert(messages)
          .values({
            content: msg,
            topicId,
            authorId: arg.author,
          })
          .returning(),
        (e) => e
      );

      if (messageResult.isErr()) {
        return err(messageResult.error);
      }

      if (messageResult.value.length == 0) {
        return err("No result from created message");
      }

      const message = messageResult.value[0];

      // 4. ⭐️ Determine if the message is the first message of the date, by getting the date of the preceding message
      const precedingMessageDate = await getPrecedingMessageDate(db, {
        topicId: topicId,
        beforeSequenceId: message.sequenceId,
      });
      if (precedingMessageDate.isErr()) {
        return err("Failed to get preceding message");
      }
      const precedingDate = precedingMessageDate.value;

      const resultType =
        existingTopicId.value.length == 0
          ? ("peer.new-topic" as const)
          : ("peer.existing-topic" as const);

      // 5. ⭐️ If message sent includes any media, complete the media URL
      if (
        message.content?.type == "picture" ||
        message.content?.type == "file"
      ) {
        message.content.url = completeMediaUrl(message.content.url);
      }

      // 6. ⭐️ If the sending of the message results in the creation of a new topic, return the information of the created topic
      if (resultType == "peer.new-topic") {
        // get the subscription permission, name, description
        // given the user, and the peer
        // the userPermission will be permission of the user
        // the peerPermission will be permission of the peer

        const topicProfile = await getP2PTopicProfile(tx, {
          user1Id: arg.author,
          user2Id: arg.sentTo,
        });
        if (topicProfile.isErr()) {
          return err(topicProfile.error);
        }
        const authorProfile = {
          name: topicProfile.value.user1Name,
          profilePhotoUrl: topicProfile.value.user1ProfilePhotoUrl,
          permissions: topicProfile.value.user1Permissions,
        };
        const receiverProfile = {
          name: topicProfile.value.user2Name,
          profilePhotoUrl: topicProfile.value.user2ProfilePhotoUrl,
          permissions: topicProfile.value.user2Permissions,
        };

        return ok({
          message: {
            ...message,
            authorId: message.authorId as UserId,
            isFirstOfDate:
              precedingDate == undefined
                ? true
                : precedingDate.toDateString() !=
                  new Date(message.createdAt).toDateString(),
          },
          type: resultType,
          createdTopicProfile: {
            authorProfile,
            receiverProfile,
            description: "",
          },
        });
      } else {
        return ok({
          message: {
            ...message,
            authorId: message.authorId as UserId,
            isFirstOfDate:
              precedingDate == undefined
                ? true
                : precedingDate.toDateString() !=
                  new Date(message.createdAt).toDateString(),
          },
          type: resultType,
        });
      }
    };

    const result = await run();
    if (result.isErr()) {
      throw result.error;
    }

    return ok(result.value);
  });

  if (messageResult.isErr()) {
    return err(messageResult.error);
  }

  return ok(messageResult.value);
};

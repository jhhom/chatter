import { fromPromise, ok, err } from "neverthrow";
import { InferModel, and, eq } from "drizzle-orm";
import { faker } from "@faker-js/faker";

import {
  subscriptions,
  topics,
  messages,
  UserId,
  TopicId,
} from "~/backend/drizzle/schema";
import { AppPgDatabase } from "~/backend/drizzle/db";
import {
  getPrecedingMessageDate,
  getTopicIdOfP2PTopicBetween,
  getP2PTopicProfile,
} from "~/backend/service/topics/common/repo";
import { getUserDefaultPermission } from "~/backend/service/topics/use-cases/permissions/permissions";
import { completeMediaUrl } from "~/backend/service/topics/use-cases/send-message/media";

export const addMessageToP2PTopic = async (
  db: AppPgDatabase,
  arg: {
    message: InferModel<typeof messages>;
    forwarder: UserId;
    forwardedTo: UserId;
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

  // 1. ⭐️ Find the topic between the author and sentTo person
  const existingTopicId = await getTopicIdOfP2PTopicBetween(db, {
    topicUser1: arg.forwarder,
    topicUser2: arg.forwardedTo,
  });
  if (existingTopicId.isErr() && existingTopicId.error.type == "database") {
    return err(existingTopicId.error);
  }

  let topicId: TopicId;

  if (existingTopicId.isOk()) {
    topicId = existingTopicId.value.topicId;
  }

  const messageResult = await db.transaction(async (tx) => {
    const run = async () => {
      // 2. ⭐️ If topic doesn't exist, create it, and create the subscription for the 2 person
      if (
        existingTopicId.isErr() &&
        existingTopicId.error.type == "topic not exist"
      ) {
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
          userId: arg.forwardedTo,
        });
        if (sentToDefaultPermission.isErr()) {
          return err(sentToDefaultPermission.error);
        }

        // create subscription for those topics
        // create a subscription for tha ttopic
        const subscriptionCreateResult = await fromPromise(
          tx.insert(subscriptions).values(
            [
              { userId: arg.forwardedTo, permission: "JRWP" },
              {
                userId: arg.forwarder,
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
      }

      const messageResult = await fromPromise(
        tx
          .insert(messages)
          .values({
            content:
              arg.message.content == null
                ? null
                : {
                    ...arg.message.content,
                    forwarded: true,
                  },
            topicId,
            authorId: arg.forwarder,
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
        existingTopicId.isErr() &&
        existingTopicId.error.type == "topic not exist"
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
          user1Id: arg.forwarder,
          user2Id: arg.forwardedTo,
        });
        if (topicProfile.isErr()) {
          return err(topicProfile.error);
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
          type: resultType,
          createdTopicProfile: {
            name: topicProfile.value.user2Name,
            description: "",
            userPermissions: topicProfile.value.user1Permissions,
            peerPermissions: topicProfile.value.user2Permissions,
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

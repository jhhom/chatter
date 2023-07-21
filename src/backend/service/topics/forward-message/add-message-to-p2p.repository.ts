import { KyselyDB, Messages } from "~/backend/schema";
import { UserId, TopicId } from "~/api-contract/subscription/subscription";
import { getUserDefaultPermission } from "~/backend/service/topics/permissions/permissions";
import { completeMediaUrl } from "~/backend/service/common/media";
import { ok, err, fromPromise } from "neverthrow";

import {
  getPrecedingMessageDate,
  getTopicIdOfP2PTopicBetween,
  getP2PTopicProfile,
} from "~/backend/service/topics/common/repo/repo";
import { faker } from "@faker-js/faker";
import { Insertable } from "kysely";

export async function addMessageToP2PTopic(
  db: KyselyDB,
  arg: {
    message: Insertable<Messages>;
    forwarder: UserId;
    forwardedTo: UserId;
  }
) {
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

  const r = await fromPromise(
    db.transaction().execute(async (tx) => {
      if (
        existingTopicId.isErr() &&
        existingTopicId.error.type == "topic not exist"
      ) {
        const topic = await tx
          .insertInto("topics")
          .values({
            id: `p2p${faker.random.alphaNumeric(12)}`,
            topicType: "p2p",
          })
          .returning("topics.id")
          .executeTakeFirstOrThrow();

        const sentToDefaultPermission = await getUserDefaultPermission(tx, {
          userId: arg.forwardedTo,
        });
        if (sentToDefaultPermission.isErr()) {
          throw sentToDefaultPermission.error;
        }

        await tx
          .insertInto("subscriptions")
          .values(
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
          )
          .execute();
      }

      const message = await tx
        .insertInto("messages")
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
        .returningAll()
        .executeTakeFirstOrThrow();

      // 4. ⭐️ Determine if the message is the first message of the date, by getting the date of the preceding message
      const precedingMessageDate = await getPrecedingMessageDate(db, {
        topicId: topicId,
        beforeSequenceId: message.sequenceId,
      });
      if (precedingMessageDate.isErr()) {
        throw new Error("Failed to get preceding message");
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
          throw topicProfile.error;
        }

        return {
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
        };
      } else {
        return {
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
        };
      }
    }),
    (e) => e
  );
  return r;
}

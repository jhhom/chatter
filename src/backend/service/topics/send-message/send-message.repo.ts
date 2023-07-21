import { KyselyDB, KyselyTransaction } from "~/backend/schema";
import {
  UserId,
  GroupTopicId,
  TopicId,
} from "~/api-contract/subscription/subscription";
import { ok, err, fromPromise } from "neverthrow";
import { faker } from "@faker-js/faker";
import { IsUserId } from "~/backend/service/common/topics";
import {
  getPrecedingMessageDate,
  getP2PTopicProfile,
} from "~/backend/service/topics/common/repo/repo";
import { getUserDefaultPermission } from "~/backend/service/topics/permissions/permissions";

import { MessageInput } from "~/backend/service/topics/send-message/send-message.schema";
import { completeMediaUrl } from "~/backend/service/common/media";
import { saveMessageMedia } from "~/backend/service/topics/send-message/send-message.media";

export async function addMessageToTopic(
  db: KyselyTransaction,
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

async function addMessageToGroupTopic(
  db: KyselyTransaction,
  arg: {
    content: MessageInput;
    author: UserId;
    sentTo: GroupTopicId;
  },
  config: {
    projectRoot: string;
  }
) {
  /**
   * Flow of adding a new message to a Group topic
   *
   * 1. Find out if the user has a subscription to the group, reject the request if the user doesn't
   * 2. Save the media of the message (if the message includes any media)
   * 3. Determine if the message is the first message of the date, by getting the date of the preceding message
   * 4. If message sent includes any media, complete the media URL
   */
  // 1. ⭐️ Find out if the user has a subscription to the group, reject the request if the user doesn't
  const existSubscription = await fromPromise(
    db
      .selectFrom("subscriptions")
      .select("id")
      .where("topicId", "=", arg.sentTo)
      .where("userId", "=", arg.author)
      .executeTakeFirstOrThrow(),
    (e) => e
  );
  if (existSubscription.isErr()) {
    return err(existSubscription.error);
  }

  // 2. ⭐️ Save the media of the message (if the message includes any media)
  const msgSaveMediaResult = await saveMessageMedia(arg.content, config);
  if (msgSaveMediaResult.isErr()) {
    return err(msgSaveMediaResult.error);
  }
  const msg = msgSaveMediaResult.value;

  const messageResult = await fromPromise(
    db
      .insertInto("messages")
      .values({
        content: msg,
        topicId: arg.sentTo,
        authorId: arg.author,
      })
      .returningAll()
      .executeTakeFirstOrThrow(),
    (e) => e
  );

  if (messageResult.isErr()) {
    return err(messageResult.error);
  }

  // 3. ⭐️ Determine if the message is the first message of the date, by getting the date of the preceding message
  const precedingMessageDate = await getPrecedingMessageDate(db, {
    topicId: arg.sentTo,
    beforeSequenceId: messageResult.value.sequenceId,
  });
  if (precedingMessageDate.isErr()) {
    return err("Failed to get preceding message");
  }
  const precedingDate = precedingMessageDate.value;

  const message = messageResult.value;

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
}

async function addMessageToP2PTopic(
  tx: KyselyTransaction,
  arg: {
    content: MessageInput;
    author: UserId;
    sentTo: UserId;
  },
  config: {
    projectRoot: string;
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

  const existingTopicId = await fromPromise(
    tx
      .selectFrom("topics")
      .innerJoin("subscriptions as sub1", "sub1.topicId", "topics.id")
      .innerJoin("subscriptions as sub2", "sub2.topicId", "topics.id")
      .where("sub1.userId", "=", arg.author)
      .where("sub2.userId", "=", arg.sentTo)
      .where("topics.topicType", "=", "p2p")
      .select("topics.id")
      .executeTakeFirst(),
    (e) => e
  );
  if (existingTopicId.isErr()) {
    return err(existingTopicId.error);
  }

  let topicId: TopicId;

  const r = await fromPromise(
    (async () => {
      // 2. ⭐️ If topic doesn't exist, create it, and create the subscription for the 2 person
      if (existingTopicId.value !== undefined) {
        topicId = existingTopicId.value.id;
      } else {
        const createdTopicId = (
          await tx
            .insertInto("topics")
            .values({
              id: `p2p${faker.random.alphaNumeric(12)}`,
              topicType: "p2p",
            })
            .returning("id")
            .executeTakeFirstOrThrow()
        ).id;

        topicId = createdTopicId;

        const sentToDefaultPermission = await getUserDefaultPermission(tx, {
          userId: arg.sentTo,
        });
        if (sentToDefaultPermission.isErr()) {
          throw sentToDefaultPermission.error;
        }

        await tx
          .insertInto("subscriptions")
          .values(
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
          )
          .execute();
      }

      // 3. ⭐️ Save the media of the message (if the message includes any media)
      const msgSaveMediaResult = await saveMessageMedia(arg.content, config);
      if (msgSaveMediaResult.isErr()) {
        throw msgSaveMediaResult.error;
      }

      const message = await tx
        .insertInto("messages")
        .values({
          content: msgSaveMediaResult.value,
          topicId,
          authorId: arg.author,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      // 4. ⭐️ Determine if the message is the first message of the date, by getting the date of the preceding message
      const precedingMessageDateResult = await getPrecedingMessageDate(tx, {
        topicId: topicId,
        beforeSequenceId: message.sequenceId,
      });
      if (precedingMessageDateResult.isErr()) {
        throw precedingMessageDateResult.error;
      }
      const precedingMessageDate = precedingMessageDateResult.value;

      const resultType =
        existingTopicId.value === undefined
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
          throw topicProfile.error;
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

        return {
          message: {
            ...message,
            authorId: message.authorId as UserId,
            isFirstOfDate:
              precedingMessageDate === undefined
                ? true
                : precedingMessageDate.toDateString() !=
                  new Date(message.createdAt).toDateString(),
          },
          type: resultType,
          createdTopicProfile: {
            authorProfile,
            receiverProfile,
            description: "",
          },
        };
      } else {
        return {
          message: {
            ...message,
            authorId: message.authorId as UserId,
            isFirstOfDate:
              precedingMessageDate === undefined
                ? true
                : precedingMessageDate.toDateString() !=
                  new Date(message.createdAt).toDateString(),
          },
          type: resultType,
        };
      }
    })(),
    (e) => e
  );
  if (r.isErr()) {
    return err(r.error);
  }

  return ok(r.value);
}

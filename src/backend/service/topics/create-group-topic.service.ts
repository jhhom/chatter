import { fromPromise, err } from "neverthrow";
import { KyselyDB } from "~/backend/schema";
import { OnlineUsers } from "~/backend/service/common/online-users";
import { faker } from "@faker-js/faker";
import {
  saveMedia,
  completeMediaUrl,
  extractFileExtensionFromBase64,
} from "~/backend/service/common/media";
import { GroupTopicId, UserId } from "~/api-contract/subscription/subscription";

import { AppError } from "~/api-contract/errors/errors";
import { ServiceResult } from "~/api-contract/types";

export async function createGroupTopic(
  ctx: { db: KyselyDB; onlineUsers: OnlineUsers },
  arg: {
    creatorId: UserId;
    groupName: string;
    photoBase64: string | null;
  },
  config: {
    projectRoot: string;
    assetServerUrl: string;
  }
): ServiceResult<"group/create_group"> {
  // The flow of creating a new group topic
  // ---------------------------------------------------------
  // 0. Save the group profile picture
  // 1. Create the topic
  // 2. Create the group topic meta
  // 3. Create a subscription for the group creator
  // 4. Create a topic event log for the group creation event

  // 0. ⭐️ Save the group profile picture
  let profilePhotoUrl: string | undefined = undefined;
  if (arg.photoBase64 !== null) {
    const fileExtension = extractFileExtensionFromBase64(arg.photoBase64);
    const result = saveMedia(
      {
        filename: `${arg.groupName}-profile${
          fileExtension ? `.${fileExtension}` : ""
        }`,
        base64: arg.photoBase64,
        type: "profile-photo.group",
      },
      config
    );
    if (result.isErr()) {
      return err(
        new AppError("SAVE_MEDIA_FAILED", {
          media: "photo",
          cause: result.error,
        })
      );
    }
    profilePhotoUrl = result.value.assetPath;
  }

  const result = await fromPromise(
    ctx.db.transaction().execute(async (tx) => {
      // 1. ⭐️ CREATE THE TOPIC, GROUP TOPIC META
      const topicId: GroupTopicId = `grp${faker.random.alphaNumeric(12)}`;

      await tx
        .insertInto("topics")
        .values({
          id: topicId,
          topicType: "group",
        })
        .returning("topics.id")
        .executeTakeFirstOrThrow();

      const groupTopicMeta = await tx
        .insertInto("groupTopicMeta")
        .values({
          topicId,
          groupName: arg.groupName,
          defaultPermissions: "JRWP",
          ownerId: arg.creatorId,
          profilePhotoUrl,
        })
        .returning([
          "groupTopicMeta.groupName",
          "groupTopicMeta.profilePhotoUrl",
        ])
        .executeTakeFirstOrThrow();

      // 2. ⭐️ CREATE A SUBSCRIPTION FOR THE GROUP CREATOR
      await tx
        .insertInto("subscriptions")
        .values({
          topicId,
          userId: arg.creatorId,
          permissions: "JRWP",
        })
        .execute();

      // 3. ⭐️ CREATE A TOPIC EVENT LOG FOR THE GROUP CREATION EVENT
      const msg = await tx
        .insertInto("messages")
        .values({ topicId })
        .returning("messages.id")
        .executeTakeFirstOrThrow();

      await tx
        .insertInto("topicEventLogs")
        .values({
          topicEvent: "create_group",
          topicId,
          actorUserId: arg.creatorId,
          messageId: msg.id,
        })
        .execute();

      return {
        topicId,
        groupName: groupTopicMeta.groupName,
        profilePhotoUrl: groupTopicMeta.profilePhotoUrl
          ? completeMediaUrl(
              config.assetServerUrl,
              groupTopicMeta.profilePhotoUrl
            )
          : null,
      };
    }),
    (e) => new AppError("UNKNOWN", { cause: e })
  );

  return result;
}

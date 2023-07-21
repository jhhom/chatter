import { fromPromise } from "neverthrow";
import { OnlineUsers } from "~/backend/service/common/online-users";
import { ok, err } from "neverthrow";
import { AppPgDatabase } from "~/backend/drizzle/db";
import {
  groupTopicMeta,
  topics,
  messages,
  subscriptions,
  topicEventLogs,
  GroupTopicId,
} from "~/backend/drizzle/schema";
import { InferModel } from "drizzle-orm";
import { faker } from "@faker-js/faker";
import {
  saveMedia,
  completeMediaUrl,
  extractFileExtensionFromBase64,
} from "~/backend/service/topics/use-cases/send-message/media";
import { UserId } from "~/backend/drizzle/schema";
import { AppError } from "~/api-contract/errors/errors";
import { ServiceResult } from "~/api-contract/types";

export async function createGroupTopic(
  ctx: { db: AppPgDatabase; onlineUsers: OnlineUsers },
  arg: {
    creatorId: UserId;
    groupName: string;
    photoBase64: string | null;
  },
  config: {
    projectRoot: string;
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
    const result = await saveMedia(
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

  const result = await ctx.db.transaction(async (tx) => {
    const run = async () => {
      // 1. ⭐️ CREATE THE TOPIC
      const topicId: GroupTopicId = `grp${faker.random.alphaNumeric(12)}`;
      const insertTopicResult = await fromPromise(
        tx
          .insert(topics)
          .values({
            id: topicId,
            topicType: "group",
          })
          .returning({
            topicId: topics.id,
          }),
        (e) => e
      ).andThen((v) => {
        if (v.length == 0) {
          return err(new Error("no row returned from creating topic"));
        }
        return ok(v[0]);
      });
      if (insertTopicResult.isErr()) {
        return err(
          new AppError("DATABASE", { cause: insertTopicResult.error })
        );
      }

      // 2. ⭐️ CREATE THE GROUP TOPIC META
      const groupTopicInsertResult = await fromPromise(
        tx
          .insert(groupTopicMeta)
          .values({
            topicId,
            groupName: arg.groupName,
            defaultPermissions: "JRWP",
            ownerId: arg.creatorId,
            profilePhotoUrl,
          })
          .returning({
            groupName: groupTopicMeta.groupName,
            profilePhotoUrl: groupTopicMeta.profilePhotoUrl,
          }),
        (e) => e
      ).andThen((v) => {
        if (v.length == 0) {
          return err(new Error(" no row returned from creating group topic"));
        }
        return ok(v[0]);
      });
      if (groupTopicInsertResult.isErr()) {
        return err(groupTopicInsertResult.error);
      }
      const groupName = groupTopicInsertResult.value.groupName;

      // 3. ⭐️ CREATE A SUBSCRIPTION FOR THE GROUP CREATOR
      const subscriptionInsertResult = await fromPromise(
        tx.insert(subscriptions).values({
          topicId,
          userId: arg.creatorId,
          permissions: "JRWP",
        }),
        (e) => e
      );
      if (subscriptionInsertResult.isErr()) {
        return err(
          new AppError("DATABASE", { cause: subscriptionInsertResult.error })
        );
      }

      // 4. ⭐️ CREATE A TOPIC EVENT LOG FOR THE GROUP CREATION EVENT
      const msg = (
        await tx
          .insert(messages)
          .values({
            topicId,
          })
          .returning({ id: messages.id })
      )[0];

      const log: InferModel<typeof topicEventLogs, "insert"> = {
        topicEvent: "create_group",
        topicId,
        actorUserId: arg.creatorId,
        messageId: msg.id,
      };

      await tx.insert(topicEventLogs).values(log);

      return ok({
        topicId,
        groupName,
        profilePhotoUrl: groupTopicInsertResult.value.profilePhotoUrl
          ? completeMediaUrl(groupTopicInsertResult.value.profilePhotoUrl)
          : null,
      });
    };

    const result = await run();
    if (result.isErr()) {
      tx.rollback();
      return err(new AppError("UNKNOWN", { cause: result.error }));
    }

    return ok(result.value);
  });

  return result;
}

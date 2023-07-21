import { and, eq } from "drizzle-orm";
import { err, fromPromise, ok } from "neverthrow";
import { ServiceResult } from "~/api-contract/types";

import { AppPgDatabase } from "~/backend/drizzle/db";
import {
  UserId,
  GroupTopicId,
  users,
  subscriptions,
  groupTopicMeta,
} from "~/backend/drizzle/schema";
import { IsUserId } from "~/backend/service/common/topics";
import { AppError } from "~/api-contract/errors/errors";
import { getTopicIdOfP2PTopicBetween } from "~/backend/service/topics/common/repo";

export async function getContactPreviewInfo(
  db: AppPgDatabase,
  arg: {
    requesterUserId: UserId;
    topicId: UserId | GroupTopicId;
  }
): ServiceResult<"topic/preview_info"> {
  if (IsUserId(arg.topicId)) {
    return await getP2PContactPreviewInfo(db, {
      requesterUserId: arg.requesterUserId,
      topicId: arg.topicId,
    });
  } else {
    return await getGroupContactPreviewInfo(db, {
      requesterUserId: arg.requesterUserId,
      topicId: arg.topicId,
    });
  }
}

async function getGroupContactPreviewInfo(
  db: AppPgDatabase,
  arg: {
    requesterUserId: UserId;
    topicId: GroupTopicId;
  }
) {
  const subscriptionResult = await fromPromise(
    db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, arg.requesterUserId),
          eq(subscriptions.topicId, arg.topicId)
        )
      ),
    (e) => new AppError("DATABASE", { cause: e })
  );
  if (subscriptionResult.isErr()) {
    return err(subscriptionResult.error);
  }
  const groupResult = await fromPromise(
    db
      .select({
        name: groupTopicMeta.groupName,
        profilePhotoUrl: groupTopicMeta.profilePhotoUrl,
      })
      .from(groupTopicMeta)
      .where(eq(groupTopicMeta.topicId, arg.topicId)),
    (e) => new AppError("DATABASE", { cause: e })
  );
  if (groupResult.isErr()) {
    return err(groupResult.error);
  }
  if (groupResult.value.length == 0) {
    return err(new AppError("RESOURCE_NOT_FOUND", { resource: "group meta" }));
  }
  if (subscriptionResult.value.length > 0) {
    return ok({
      type: "user already has contact" as const,
      value: {
        name: groupResult.value[0].name,
      },
    });
  } else {
    return ok({
      type: "new group contact" as const,
      value: groupResult.value[0],
    });
  }
}

async function getP2PContactPreviewInfo(
  db: AppPgDatabase,
  arg: {
    requesterUserId: UserId;
    topicId: UserId;
  }
) {
  const topicIdResult = await getTopicIdOfP2PTopicBetween(db, {
    topicUser1: arg.requesterUserId,
    topicUser2: arg.topicId,
  });
  if (topicIdResult.isErr()) {
    if (topicIdResult.error.type == "topic not exist") {
      const user = await fromPromise(
        db
          .select({
            name: users.fullname,
            profilePhotoUrl: users.profilePhotoUrl,
            defaultPermissions: users.defaultPermissions,
          })
          .from(users)
          .where(eq(users.id, arg.topicId)),
        (e) => new AppError("DATABASE", { cause: e })
      );
      if (user.isErr()) {
        return err(user.error);
      }
      if (user.value.length == 0) {
        return err(new AppError("RESOURCE_NOT_FOUND", { resource: "user" }));
      }
      return ok({
        type: "new p2p contact" as const,
        value: user.value[0],
      });
    } else {
      return err(new AppError("UNKNOWN", { cause: topicIdResult.error }));
    }
  }

  const username = await fromPromise(
    db
      .select({ name: users.fullname })
      .from(users)
      .where(eq(users.id, arg.topicId)),
    (e) => new AppError("DATABASE", { cause: e })
  );
  if (username.isErr()) {
    return err(username.error);
  }
  if (username.value.length == 0) {
    return err(new AppError("RESOURCE_NOT_FOUND", { resource: "username" }));
  }

  return ok({
    type: "user already has contact" as const,
    value: {
      name: username.value[0].name,
    },
  });
}

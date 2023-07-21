import { ServiceResult } from "~/api-contract/types";
import { KyselyDB } from "~/backend/schema";
import { IsUserId } from "~/backend/service/common/topics";
import { AppError } from "~/api-contract/errors/errors";
import { getTopicIdOfP2PTopicBetween } from "~/backend/service/topics/common/repo/repo";
import { UserId, GroupTopicId } from "~/api-contract/subscription/subscription";

import { fromPromise, ok, err } from "neverthrow";

export async function getContactPreviewInfo(
  db: KyselyDB,
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
  db: KyselyDB,
  arg: {
    requesterUserId: UserId;
    topicId: GroupTopicId;
  }
) {
  const subscriptionResult = await fromPromise(
    db
      .selectFrom("subscriptions")
      .select("id")
      .where("userId", "=", arg.requesterUserId)
      .where("topicId", "=", arg.topicId)
      .executeTakeFirst(),
    (e) => new AppError("DATABASE", { cause: e })
  );
  if (subscriptionResult.isErr()) {
    return err(subscriptionResult.error);
  }

  const groupResult = await fromPromise(
    db
      .selectFrom("groupTopicMeta")
      .select(["groupName as name", "profilePhotoUrl"])
      .where("topicId", "=", arg.topicId)
      .executeTakeFirstOrThrow(),
    (e) => new AppError("DATABASE", { cause: e })
  );
  if (groupResult.isErr()) {
    return err(groupResult.error);
  }

  if (subscriptionResult.value !== undefined) {
    return ok({
      type: "user already has contact" as const,
      value: groupResult.value,
    });
  } else {
    return ok({
      type: "new group contact" as const,
      value: groupResult.value,
    });
  }
}

async function getP2PContactPreviewInfo(
  db: KyselyDB,
  arg: {
    requesterUserId: UserId;
    topicId: UserId;
  }
) {
  const topicIdResult = await getTopicIdOfP2PTopicBetween(db, {
    topicUser1: arg.requesterUserId,
    topicUser2: arg.topicId,
  });

  if (topicIdResult.isErr() && topicIdResult.error.type != "topic not exist") {
    return err(new AppError("UNKNOWN", { cause: topicIdResult.error }));
  } else if (
    topicIdResult.isErr() &&
    topicIdResult.error.type == "topic not exist"
  ) {
    const user = await fromPromise(
      db
        .selectFrom("users")
        .select(["fullname as name", "profilePhotoUrl", "defaultPermissions"])
        .where("users.id", "=", arg.topicId)
        .executeTakeFirstOrThrow(),
      (e) => new AppError("DATABASE", { cause: e })
    );
    if (user.isErr()) {
      return err(user.error);
    }
    return ok({
      type: "new p2p contact" as const,
      value: user.value,
    });
  }

  const username = await fromPromise(
    db
      .selectFrom("users")
      .select("fullname as name")
      .where("users.id", "=", arg.topicId)
      .executeTakeFirstOrThrow(),
    (e) => new AppError("DATABASE", { cause: e })
  );
  if (username.isErr()) {
    return err(username.error);
  }

  return ok({
    type: "user already has contact" as const,
    value: username.value,
  });
}

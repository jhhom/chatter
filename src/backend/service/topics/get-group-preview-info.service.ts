import { fromPromise, ok, err } from "neverthrow";
import { type ServiceResult } from "~/api-contract/types";
import { AppError } from "~/api-contract/errors/errors";

import { type KyselyDB } from "~/backend/schema";
import { completeMediaUrl } from "~/backend/service/common/media";
import { permission } from "~/backend/service/common/permissions";

export async function getGroupPreviewInfo(
  db: KyselyDB,
  groupInviteLinkId: string
): ServiceResult<"group/preview_info"> {
  const groupResult = await fromPromise(
    db
      .selectFrom("groupTopicMeta")
      .select(["topicId", "groupName", "profilePhotoUrl", "defaultPermissions"])
      .where("inviteLink", "=", groupInviteLinkId)
      .executeTakeFirstOrThrow(),
    (e) => new AppError("DATABASE", { cause: e })
  );
  if (groupResult.isErr()) {
    return err(groupResult.error);
  }

  const group = {
    ...groupResult.value,
    profilePhotoUrl: groupResult.value.profilePhotoUrl
      ? completeMediaUrl(groupResult.value.profilePhotoUrl)
      : null,
  };

  const numOfSubs = await fromPromise(
    db
      .selectFrom("subscriptions")
      .select(db.fn.count<string>("id").as("numberOfParticipants"))
      .where("topicId", "=", group.topicId)
      .groupBy("topicId")
      .executeTakeFirstOrThrow(),
    (e) => new AppError("DATABASE", { cause: e })
  );
  if (numOfSubs.isErr()) {
    return err(numOfSubs.error);
  }

  return ok({
    groupId: group.topicId,
    groupName: group.groupName,
    numberOfParticipants: parseInt(numOfSubs.value.numberOfParticipants),
    profilePhotoUrl: group.profilePhotoUrl,
    canNewInviteJoin: permission(group.defaultPermissions).canJoin(),
  });
}

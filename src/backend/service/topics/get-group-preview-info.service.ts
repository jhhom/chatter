import { fromPromise, ok, err } from "neverthrow";
import { ServiceResult } from "~/api-contract/types";
import { AppError } from "~/api-contract/errors/errors";

import { KyselyDB } from "~/backend/schema";
import { GroupTopicId } from "~/api-contract/subscription/subscription";
import { completeMediaUrl } from "~/backend/service/common/media";

export async function getGroupPreviewInfo(
  db: KyselyDB,
  groupInviteLinkId: string
): ServiceResult<"group/preview_info"> {
  const groupResult = await fromPromise(
    db
      .selectFrom("groupTopicMeta")
      .select(["topicId", "groupName", "profilePhotoUrl"])
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

  const { count } = db.fn;

  const numOfSubs = await fromPromise(
    db
      .selectFrom("subscriptions")
      .select(count<number>("id").as("numberOfParticipants"))
      .where("topicId", "=", group.topicId)
      .groupBy("topicId")
      .executeTakeFirstOrThrow(),
    (e) => new AppError("DATABASE", { cause: e })
  );
  if (numOfSubs.isErr()) {
    return err(numOfSubs.error);
  }

  return ok({
    groupId: group.topicId as GroupTopicId,
    groupName: group.groupName,
    numberOfParticipants: numOfSubs.value.numberOfParticipants,
    profilePhotoUrl: group.profilePhotoUrl,
  });
}

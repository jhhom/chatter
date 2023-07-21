import { eq, sql } from "drizzle-orm";
import { fromPromise, ok, err } from "neverthrow";
import { ServiceResult } from "~/api-contract/types";
import { AppError } from "~/api-contract/errors/errors";

import { AppPgDatabase } from "~/backend/drizzle/db";
import {
  GroupTopicId,
  groupTopicMeta,
  subscriptions,
} from "~/backend/drizzle/schema";
import { completeMediaUrl } from "~/backend/service/topics/use-cases/send-message/media";

export async function getGroupPreviewInfo(
  db: AppPgDatabase,
  arg: {
    groupInviteLinkId: string;
  }
): ServiceResult<"group/preview_info"> {
  // get group name
  // get number of participants
  const groupResult = await fromPromise(
    db
      .select({
        topicId: groupTopicMeta.topicId,
        groupName: groupTopicMeta.groupName,
        profilePhotoUrl: groupTopicMeta.profilePhotoUrl,
      })
      .from(groupTopicMeta)
      .where(eq(groupTopicMeta.inviteLink, arg.groupInviteLinkId)),
    (e) => new AppError("DATABASE", { cause: e })
  );
  if (groupResult.isErr()) {
    return err(groupResult.error);
  }
  // TODO: handle the case where link is archived
  if (groupResult.value.length == 0) {
    return err(new AppError("RESOURCE_NOT_FOUND", { resource: "group" }));
  }
  const group = {
    ...groupResult.value[0],
    profilePhotoUrl: groupResult.value[0].profilePhotoUrl
      ? completeMediaUrl(groupResult.value[0].profilePhotoUrl)
      : null,
  };

  // get the number of subscribers
  const numOfSubsResult = await fromPromise(
    db
      .select({
        numberOfParticipants: sql<number>`COUNT(${subscriptions.id})`,
      })
      .from(subscriptions)
      .where(eq(subscriptions.topicId, group.topicId))
      .groupBy(subscriptions.topicId),
    (e) => new AppError("DATABASE", { cause: e })
  );
  if (numOfSubsResult.isErr()) {
    return err(numOfSubsResult.error);
  }
  if (numOfSubsResult.value.length == 0) {
    return err(
      new AppError("RESOURCE_NOT_FOUND", { resource: "number of subscribers" })
    );
  }
  const numOfSubs = numOfSubsResult.value[0];

  return ok({
    groupId: group.topicId as GroupTopicId,
    groupName: group.groupName,
    numberOfParticipants: numOfSubs.numberOfParticipants,
    profilePhotoUrl: group.profilePhotoUrl,
  });
}

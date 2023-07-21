import { KyselyDB } from "~/backend/schema";
import { GroupTopicId, UserId } from "~/api-contract/subscription/subscription";
import { ok, err, fromPromise } from "neverthrow";
import { ServiceResult } from "~/api-contract/types";
import { AppError } from "~/api-contract/errors/errors";

export async function isUserAlreadyAMemberOfGroup(
  db: KyselyDB,
  arg: {
    userId: UserId;
    groupTopicId: GroupTopicId;
  }
): ServiceResult<"group/am_i_group_member_of"> {
  return fromPromise(
    db
      .selectFrom("subscriptions")
      .select("id")
      .where("userId", "=", arg.userId)
      .where("topicId", "=", arg.groupTopicId)
      .executeTakeFirst(),
    (e) => new AppError("DATABASE", { cause: e })
  ).map((v) => v !== undefined);
}

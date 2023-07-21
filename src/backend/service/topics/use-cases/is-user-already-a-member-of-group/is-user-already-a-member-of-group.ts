import { AppPgDatabase } from "~/backend/drizzle/db";
import { GroupTopicId, UserId, subscriptions } from "~/backend/drizzle/schema";
import { and, eq } from "drizzle-orm";
import { ok, err, fromPromise } from "neverthrow";
import { ServiceResult } from "~/api-contract/types";
import { AppError } from "~/api-contract/errors/errors";

export async function isUserAlreadyAMemberOfGroup(
  db: AppPgDatabase,
  arg: {
    userId: UserId;
    groupTopicId: GroupTopicId;
  }
): ServiceResult<"group/am_i_group_member_of"> {
  const subsId = await fromPromise(
    db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, arg.userId),
          eq(subscriptions.topicId, arg.groupTopicId)
        )
      ),
    (e) => new AppError("DATABASE", { cause: e })
  );
  if (subsId.isErr()) {
    return err(subsId.error);
  }
  return ok(subsId.value.length !== 0);
}

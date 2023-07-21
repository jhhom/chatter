import { AppPgDatabase } from "~/backend/drizzle/db";
import { GroupTopicId, UserId } from "~/backend/drizzle/schema";
import { ok, err } from "neverthrow";
import { OnlineUsers } from "~/backend/service/common/online-users";
import { getGroupMembers as db_getGroupMembers } from "~/backend/service/topics/common/repo";
import { ServiceResult } from "~/api-contract/types";
import { AppError } from "~/api-contract/errors/errors";

export async function getGroupMembers(
  ctx: { db: AppPgDatabase; onlineUsers: OnlineUsers },
  input: { groupTopicId: GroupTopicId }
): ServiceResult<"group/members"> {
  const members = await db_getGroupMembers(ctx, input);
  if (members.isErr()) {
    return err(new AppError("DATABASE", { cause: members.error }));
  }
  return ok(
    members.value.map((m) => ({
      ...m,
      online: ctx.onlineUsers.isUserOnline(m.id),
    }))
  );
}

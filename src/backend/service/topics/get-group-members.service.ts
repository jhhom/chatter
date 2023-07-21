import { KyselyDB } from "~/backend/schema";
import { GroupTopicId } from "~/api-contract/subscription/subscription";
import { ok, err } from "neverthrow";
import { OnlineUsers } from "~/backend/service/common/online-users";
import { getGroupMembers as db_getGroupMembers } from "~/backend/service/topics/common/repo/repo";
import { ServiceResult } from "~/api-contract/types";
import { AppError } from "~/api-contract/errors/errors";

export async function getGroupMembers(
  ctx: { db: KyselyDB; onlineUsers: OnlineUsers },
  input: { groupTopicId: GroupTopicId }
): ServiceResult<"group/members"> {
  const members = await db_getGroupMembers(ctx.db, input);
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

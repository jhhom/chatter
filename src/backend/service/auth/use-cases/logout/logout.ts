import { AppPgDatabase } from "~/backend/drizzle/db";
import { OnlineUsers } from "~/backend/service/common/online-users";
import { IServiceAuthContext } from "~/backend/router/context";
import { notifyStatus } from "~/backend/service/auth/use-cases/common/notify-status/notify-status";
import { ok } from "neverthrow";
import { updateUserLastOnline } from "~/backend/service/topics/common/repo";
import { ServiceResult } from "~/api-contract/types";

export async function logout(
  ctx: {
    db: AppPgDatabase;
    onlineUsers: OnlineUsers;
  },
  arg: {
    ctx: IServiceAuthContext;
  }
): ServiceResult<"auth/logout"> {
  const removal = ctx.onlineUsers.remove(
    arg.ctx.auth.userId,
    arg.ctx.auth.socketId
  );
  if (!removal.isUserStillOnline) {
    await updateUserLastOnline(ctx.db, {
      userId: arg.ctx.auth.userId,
      lastOnline: new Date(),
    });

    await notifyStatus(ctx, {
      userId: arg.ctx.auth.userId,
      groupStatusChangeNotificationList: removal.toNotify,
      groupsWithChangesOnOnlineMemberList: removal.groupsUserIsRemoved,
      online: false,
    });
  }
  arg.ctx.resetAuth();
  return ok({});
}

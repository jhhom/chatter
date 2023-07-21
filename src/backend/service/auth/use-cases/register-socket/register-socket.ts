import { AppPgDatabase } from "~/backend/drizzle/db";
import { IServiceContext } from "~/backend/router/context";
import { Socket } from "~/backend/router/socket";
import { OnlineUsers } from "~/backend/service/common/online-users";
import { notifyStatus } from "~/backend/service/auth/use-cases/common/notify-status/notify-status";
import { updateUserLastOnline } from "~/backend/service/topics/common/repo";

/**
 * `registerSocket` attaches the `emitter` from the `observable` onto the `ctx`
 *
 * so that it's available for use for later functions
 *
 * it's parallel to when a new socket connection is made in normal applications (without TRPC), but the socket is not yet authenticated
 *
 * @param ctx
 * @param input
 * @returns a cleanup function that is run when observable cleans up (which is when the socket disconnects)
 */
export function registerSocket(
  ctx: {
    db: AppPgDatabase;
    onlineUsers: OnlineUsers;
  },
  input: {
    userCtx: IServiceContext;
  }
) {
  const { userCtx } = input;
  const observableCallback = (emit: Socket) => {
    userCtx.setSocket(emit);

    const cleanup = async () => {
      if (userCtx.auth != undefined) {
        const removal = ctx.onlineUsers.remove(
          userCtx.auth.userId,
          userCtx.auth.socketId
        );

        if (!removal.isUserStillOnline) {
          await updateUserLastOnline(userCtx.db, {
            userId: userCtx.auth.userId,
            lastOnline: new Date(),
          });

          await notifyStatus(
            { db: userCtx.db, onlineUsers: ctx.onlineUsers },
            {
              userId: userCtx.auth.userId,
              online: false,
              groupStatusChangeNotificationList: removal.toNotify,
              groupsWithChangesOnOnlineMemberList: removal.groupsUserIsRemoved,
            }
          );
        }
      }
      // do we need to set socket as undefined? I think it doesn't matter whether we got set is as undefined or not
      // since cleanup is called when user's socket disconnect
      // thus the userCtx will no longer be used
      // if user re-connect, a new context will be created, and a new socket will be registered
      // there will be no effect if we set it as undefined either, so let's just leave this as is
      userCtx.setSocket(undefined);
    };

    return cleanup;
  };
  return observableCallback;
}

import { jwt } from "~/backend/wrapper/wrapper";
import { fromPromise, ok, err } from "neverthrow";
import { JwtPayload } from "jsonwebtoken";
import { findOneUser } from "~/backend/service/auth/common/repo";
import { notifyStatus } from "~/backend/service/auth/common/notify-status/notify-status";
import { OnlineUsers } from "~/backend/service/common/online-users";
import { IServiceContext } from "~/backend/router/context";

import { ServiceResult } from "~/api-contract/types";
import { AppError } from "~/api-contract/errors/errors";
import { completeMediaUrl } from "~/backend/service/common/media";

export async function autoLogin(
  ctx: { onlineUsers: OnlineUsers; assetServerUrl: string },
  input: {
    jwtToken: string;
    userCtx: IServiceContext;
  }
): ServiceResult<"auth/login_with_token"> {
  const { userCtx } = input;
  if (!userCtx.socket) {
    return err(
      new AppError("UNKNOWN", {
        cause: `User don't have a socket session registered`,
      })
    );
  }

  const decoded = jwt.verify(input.jwtToken, userCtx.config.JWT_KEY);
  if (decoded.isErr()) {
    return err(new AppError("UNKNOWN", { cause: decoded.error }));
  }

  const username = (decoded.value as JwtPayload).username as string;
  if (!username || username == "") {
    return err(new AppError("UNKNOWN", { cause: "Token is invalid" }));
  }

  const result = await findOneUser(userCtx.db, { username });
  if (result.isErr()) {
    return err(new AppError("UNKNOWN", { cause: result.error }));
  }

  const user = {
    ...result.value,
    profilePhotoUrl: result.value.profilePhotoUrl
      ? completeMediaUrl(ctx.assetServerUrl, result.value.profilePhotoUrl)
      : null,
  };

  const { socketId, toNotify: groupStatusChangeNotificationList } =
    ctx.onlineUsers.add(user.id, user.subscribedGroupTopicIds, userCtx.socket);

  userCtx.setAuth(user.id, user.username, user.email, socketId);

  await notifyStatus(
    {
      onlineUsers: ctx.onlineUsers,
      db: userCtx.db,
    },
    {
      userId: user.id,
      online: true,
      groupStatusChangeNotificationList,
      groupsWithChangesOnOnlineMemberList: user.subscribedGroupTopicIds,
    }
  );

  return ok(user);
}

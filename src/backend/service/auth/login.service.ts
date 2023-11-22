import { ok, err } from "neverthrow";
import { JwtPayload } from "jsonwebtoken";

import { type IServiceContext } from "~/backend/router/context";
import { type OnlineUsers } from "~/backend/service/common/online-users";
import { notifyStatus } from "~/backend/service/auth/common/notify-status/notify-status";
import { findOneUser } from "~/backend/service/auth/common/repo";
import { completeMediaUrl } from "~/backend/service/common/media";
import { jwt, bcrypt } from "~/backend/wrapper/wrapper";

import { type ServiceResult } from "~/api-contract/types";
import { AppError } from "~/api-contract/errors/errors";

export async function login(
  ctx: { onlineUsers: OnlineUsers; assetServerUrl: string },
  input: {
    username: string;
    password: string;
    userCtx: IServiceContext;
  }
): ServiceResult<"auth/login"> {
  const { userCtx } = input;
  if (!userCtx.socket) {
    return err(
      new AppError("UNKNOWN", {
        cause: `User don't have a socket session registered`,
      })
    );
  }

  const result = await findOneUser(userCtx.db, {
    username: input.username,
  });
  if (result.isErr()) {
    return err(new AppError("RESOURCE_NOT_FOUND", { resource: "user" }));
  }

  const user = result.value;

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    return err(new AppError("AUTH.INCORRECT_PASSWORD", undefined));
  }

  const token = jwt.sign(
    {
      username: user.username,
      email: user.email,
    } as JwtPayload,
    userCtx.config.JWT_KEY,
    { expiresIn: "10000h" }
  );
  if (token.isErr()) {
    return err(new AppError("UNKNOWN", { cause: token.error }));
  }

  const { socketId, toNotify: groupStatusChangeNotificationList } =
    ctx.onlineUsers.add(user.id, user.subscribedGroupTopicIds, userCtx.socket);

  userCtx.setAuth(user.id, user.username, user.email, socketId);

  await notifyStatus(
    { db: userCtx.db, onlineUsers: ctx.onlineUsers },
    {
      userId: user.id,
      online: true,
      groupStatusChangeNotificationList,
      groupsWithChangesOnOnlineMemberList: user.subscribedGroupTopicIds,
    }
  );

  return ok({
    userId: user.id,
    token: token.value,
    username: user.username,
    email: user.email,
    fullname: user.fullname,
    defaultPermissions: user.defaultPermissions,
    profilePhotoUrl: user.profilePhotoUrl
      ? completeMediaUrl(ctx.assetServerUrl, user.profilePhotoUrl)
      : null,
  });
}

import { fromPromise, ok, err } from "neverthrow";
import { JwtPayload } from "jsonwebtoken";

import { IServiceContext } from "~/backend/router/context";
import { OnlineUsers } from "~/backend/service/common/online-users";
import { notifyStatus } from "~/backend/service/auth/use-cases/common/notify-status/notify-status";
import { findOneUser } from "~/backend/service/auth/use-cases/common/repo/repo";
import { jwt, bcrypt } from "~/backend/wrapper/wrapper";
import { completeMediaUrl } from "~/backend/service/topics/use-cases/send-message/media";

import { ServiceResult } from "~/api-contract/types";
import { AppError } from "~/api-contract/errors/errors";

export async function login(
  ctx: { onlineUsers: OnlineUsers },
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

  const result = await findOneUser(
    { db: userCtx.db },
    {
      username: input.username,
    }
  );
  if (result.isErr()) {
    return err(new AppError("RESOURCE_NOT_FOUND", { resource: "user" }));
  }

  const user = result.value;

  console.log("INPUT PASSWORD", input.password);
  console.log("USER", JSON.stringify(user, null, 4));

  const passwordValidResult = await bcrypt.compare(
    input.password,
    user.passwordHash
  );
  if (passwordValidResult.isErr()) {
    return err(new AppError("UNKNOWN", { cause: passwordValidResult.error }));
  } else if (!passwordValidResult.value) {
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
    ctx.onlineUsers.add(
      user.userId,
      user.subscribedGroupTopicIds,
      userCtx.socket
    );

  userCtx.setAuth(user.userId, user.username, user.email, socketId);

  await notifyStatus(
    { db: userCtx.db, onlineUsers: ctx.onlineUsers },
    {
      userId: user.userId,
      online: true,
      groupStatusChangeNotificationList,
      groupsWithChangesOnOnlineMemberList: user.subscribedGroupTopicIds,
    }
  );

  return ok({
    userId: user.userId,
    token: token.value,
    username: user.username,
    email: user.email,
    fullname: user.fullname,
    defaultPermissions: user.defaultPermissions,
    profilePhotoUrl: user.profilePhotoUrl
      ? completeMediaUrl(user.profilePhotoUrl)
      : null,
  });
}

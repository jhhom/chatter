import { ok, err } from "neverthrow";

import { MockEmitter } from "~/backend/service/test-utils/mock-emitter";
import { OnlineUsers } from "~/backend/service/common/online-users";
import { ConfigSchema } from "~/backend/config/config";
import { KyselyDB } from "~/backend/schema";
import { Context } from "~/backend/router/context";
import { authUsecase } from "~/backend/service/auth";
import { IServiceAuthContext } from "~/backend/router/context";

export async function login(
  ctx: { onlineUsers: OnlineUsers; config: ConfigSchema; db: KyselyDB },
  input: {
    username: string;
    password: string;
  }
) {
  const alice = {
    ctx: new Context(
      {
        DATABASE_URL: ctx.config.DATABASE_URL,
        JWT_KEY: ctx.config.JWT_KEY,
        PROJECT_ROOT: "",
      },
      ctx.db
    ),
    emitter: new MockEmitter(),
  };

  const callback = await authUsecase.registerSocket(
    { db: ctx.db, onlineUsers: ctx.onlineUsers },
    { userCtx: alice.ctx }
  );
  callback(alice.emitter.socket);

  const result = await authUsecase.login(
    { onlineUsers: ctx.onlineUsers },
    {
      ...input,
      userCtx: alice.ctx,
    }
  );
  if (result.isErr()) {
    return err(result.error);
  }
  return ok({
    ctx: alice.ctx as IServiceAuthContext,
    emitter: alice.emitter,
    token: result.value.token,
  });
}

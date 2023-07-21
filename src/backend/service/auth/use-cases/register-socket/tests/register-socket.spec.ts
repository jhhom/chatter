/// <reference types="jest-extended" />
import { drizzle } from "drizzle-orm/node-postgres";
import { expect, describe, test } from "vitest";
import { Pool } from "pg";
import { InferModel, sql } from "drizzle-orm";

import { testUtil } from "../../../../test-utils";
import { OnlineUsers } from "../../../../common/online-users";
import { registerSocket } from "../register-socket";
import { Context, IServiceAuthContext } from "../../../../../router/context";
import { MockEmitter } from "../../../../test-utils/mock-emitter";

const config = {
  DB_URL: "postgres://dbuser:dbuser@localhost/tinode_clone_test",
  JWT_KEY: "xxx-xxx",
};

const db = drizzle(new Pool({ connectionString: config.DB_URL }), {
  logger: true,
});

describe("Auth", () => {
  test("register socket", async () => {
    // 1. ARRANGE
    await db.execute(
      sql`TRUNCATE TABLE users, topics, messages RESTART IDENTITY CASCADE;`
    );

    const seedResult = await testUtil.seed(db);
    if (seedResult.isErr()) {
      throw seedResult.error;
    }
    const [seededUsers, _] = seedResult.value;

    const onlineUsers = new OnlineUsers();

    // 2. ACT
    // 2.1 register a socket
    const user = {
      emitter: new MockEmitter(),
      ctx: new Context(
        {
          DATABASE_URL: config.DB_URL,
          JWT_KEY: config.JWT_KEY,
        },
        db
      ),
    };
    expect(user.ctx.socket).toBe(undefined);
    const callback = registerSocket({ onlineUsers }, { userCtx: user.ctx });
    const socketCleanup = callback(user.emitter.socket);

    // 3. ASSERT
    expect(user.emitter.socket).toBe(user.ctx.socket);

    await socketCleanup();
  }, 60_000);
});

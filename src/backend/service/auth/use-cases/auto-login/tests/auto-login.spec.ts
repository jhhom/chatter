import { drizzle } from "drizzle-orm/node-postgres";
import { expect, describe, test } from "vitest";
import { Pool } from "pg";
import { InferModel, sql } from "drizzle-orm";
import { autoLogin } from "../auto-login";

import { testUtil } from "../../../../test-utils";
import { OnlineUsers } from "../../../../common/online-users";
import { logout } from "../../logout/logout";

const config = {
  DB_URL: "postgres://dbuser:dbuser@localhost/tinode_clone_test",
  JWT_KEY: "xxx-xxx",
};

const db = drizzle(new Pool({ connectionString: config.DB_URL }), {
  logger: true,
});

describe("Auth", () => {
  test("auto-login", async () => {
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
    // 2.1 Login as Alice
    const aliceLoginResult = await testUtil.login(
      {
        onlineUsers,
        config: {
          DATABASE_URL: config.DB_URL,
          JWT_KEY: config.JWT_KEY,
          PROJECT_ROOT: "",
        },
        db,
      },
      {
        username: seededUsers.alice.username,
        password: seededUsers.alice.password,
      }
    );
    if (aliceLoginResult.isErr()) {
      throw aliceLoginResult.error;
    }
    const alice = aliceLoginResult.value;

    // 2.2 Login as Carol
    const carolLoginResult = await testUtil.login(
      {
        onlineUsers,
        config: {
          DATABASE_URL: config.DB_URL,
          JWT_KEY: config.JWT_KEY,
          PROJECT_ROOT: "",
        },
        db,
      },
      {
        username: seededUsers.carol.username,
        password: seededUsers.carol.password,
      }
    );
    if (carolLoginResult.isErr()) {
      throw carolLoginResult.error;
    }
    const carol = carolLoginResult.value;

    // 2.3 alice log out
    {
      const result = await logout(
        { db, onlineUsers },
        {
          ctx: alice.ctx,
        }
      );
      if (result.isErr()) {
        throw result.error;
      }
    }

    // 2.4 alice reuse token to auto-login
    {
      const result = await autoLogin(
        { onlineUsers },
        {
          jwtToken: alice.token,
          userCtx: alice.ctx,
        }
      );
      if (result.isErr()) {
        throw result.error;
      }
      expect(result.value.username).toBe("alice");
    }

    // 3. ASSERT
    // 3.1 assert carol receive a notification
    {
      const lastReceived = carol.emitter.lastReceived();
      if (lastReceived === undefined) {
        throw new Error("last received is undefined");
      }
      if (lastReceived.event != "notification.on") {
        throw new Error("last notification is not user on");
      }
      expect(lastReceived.payload.topicId).toBe(seededUsers.alice.id);
    }
  }, 60_000);
});

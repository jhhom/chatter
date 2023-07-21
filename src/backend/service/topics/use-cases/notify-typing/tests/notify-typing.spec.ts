/// <reference types="jest-extended" />
import { drizzle } from "drizzle-orm/node-postgres";
import { expect, describe, test } from "vitest";
import { Pool } from "pg";
import { InferModel, sql } from "drizzle-orm";

import notifyIsTyping from "~/backend/service/topics/use-cases/notify-typing/notify-typing";
import { testUtil } from "~/backend/service/test-utils";
import { OnlineUsers } from "~/backend/service/common/online-users";
import * as schema from "~/backend/drizzle/schema";

const config = {
  DATABASE_URL: "postgres://dbuser:dbuser@localhost/tinode_clone_test",
  JWT_KEY: "xxx-xxx",
};

const db = drizzle(new Pool({ connectionString: config.DATABASE_URL }), {
  logger: true,
  schema,
});

describe("Topic", () => {
  test("notify status", async () => {
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
          DATABASE_URL: config.DATABASE_URL,
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
          DATABASE_URL: config.DATABASE_URL,
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

    // 3. ASSERT
    {
      await notifyIsTyping(
        { onlineUsers, db },
        {
          action: "typing",
          notifierId: seededUsers.carol.id,
          topicId: seededUsers.alice.id,
        }
      );

      const lastMsg = alice.emitter.lastReceived();
      if (lastMsg === undefined) {
        throw new Error("alice last message is undefined");
      }
      if (lastMsg.event != "notification.typing") {
        throw new Error("last received event is not message");
      }
      expect(lastMsg.payload.topicId).toBe(seededUsers.carol.id);
    }
  }, 60_000);
});

/// <reference types="jest-extended" />
import { drizzle } from "drizzle-orm/node-postgres";
import { expect, describe, test, beforeAll } from "vitest";
import { Pool } from "pg";
import { InferModel, sql } from "drizzle-orm";

import { testUtil } from "~/backend/service/test-utils";
import { OnlineUsers } from "~/backend/service/common/online-users";
import { getContactStatus } from "~/backend/service/topics/use-cases/get-contact-status/get-contact-status";

import * as schema from "~/backend/drizzle/schema";

const config = {
  DB_URL: "postgres://dbuser:dbuser@localhost/tinode_clone_test",
  JWT_KEY: "xxx-xxx",
};

const db = drizzle(new Pool({ connectionString: config.DB_URL }), {
  logger: true,
  schema,
});

describe("Auth", async () => {
  test("auto-login", async () => {
    // 1. ARRANGE
    await db.execute(
      sql`TRUNCATE TABLE users, topics, subscriptions, messages RESTART IDENTITY CASCADE;`
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

    // 3. ASSERT
    // 3.1 assert alice receive a on notification
    {
      const lastReceived = alice.emitter.lastReceived();
      if (lastReceived === undefined) {
        throw new Error("last received is undefined");
      }
      if (lastReceived.event != "notification.on") {
        throw new Error("last notification is not user on");
      }
      expect(lastReceived.payload.topicId).toBe(seededUsers.carol.id);
    }

    // 3.2 assert getUserTopics return correct user statuses
    {
      const result = await getContactStatus(
        { db, onlineUsers },
        {
          userId: seededUsers.carol.id,
        }
      );
      if (result.isErr()) {
        throw result.error;
      }
      expect(result.value.p2pContactStatus).toBeArrayOfSize(3);
      expect(result.value.p2pContactStatus).toSatisfyAny(
        (v) => v.topicId == seededUsers.alice.id && v.online
      );
    }

    // 3.3 some additional assertions
    {
      const onlineUsersEntries = Array.from(onlineUsers.entries());
      expect(onlineUsersEntries).toBeArrayOfSize(2);
    }
  }, 60_000);
});

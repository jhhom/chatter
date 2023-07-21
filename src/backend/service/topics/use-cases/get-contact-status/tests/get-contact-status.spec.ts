/// <reference types="jest-extended" />
import { drizzle } from "drizzle-orm/node-postgres";
import { InferModel, sql } from "drizzle-orm";
import { expect, describe, test } from "vitest";
import { Pool } from "pg";
import { DateTime } from "luxon";

import { getContactStatus } from "~/backend/service/topics/use-cases/get-contact-status/get-contact-status";
import { OnlineUsers } from "~/backend/service/common/online-users";
import * as schema from "~/backend/drizzle/schema";
import { testUtil } from "~/backend/service/test-utils";

const config = {
  DB_URL: "postgres://dbuser:dbuser@localhost/tinode_clone_test",
  JWT_KEY: "xxx-xxx",
  PROJECT_ROOT:
    "/Users/joohom/Documents/Projects/SideProjects/tinode/tinode-clone/tinode-clone-3",
};

const db = drizzle(new Pool({ connectionString: config.DB_URL }), {
  logger: true,
  schema,
});

describe("Topic", () => {
  test("parsing date time from database", async () => {
    const dt = "2023-06-14 04:21:38.704";
    const parsed = DateTime.fromSQL(dt, { zone: "UTC" });
    console.log(parsed.toLocal().toFormat("LLL dd, T"));
  });

  test("get contact status", async () => {
    // 1. ARRANGE
    await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE;`);

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
          PROJECT_ROOT: config.PROJECT_ROOT,
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
          PROJECT_ROOT: config.PROJECT_ROOT,
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
      const received = alice.emitter.lastReceived();
      expect(received).toBeDefined();
      expect(received?.event).toBe("notification.on");
      expect(received?.payload).toContainEntry([
        "topicId",
        seededUsers.carol.id,
      ]);
    }

    {
      // 4.1 ACT
      const statuses = await getContactStatus(
        { db, onlineUsers },
        { userId: seededUsers.carol.id }
      );
      if (statuses.isErr()) {
        throw statuses.error;
      }

      // 4.2 ASSERT
      expect(statuses.value.p2pContactStatus).toSatisfyAny(
        (v) => v.topicId == seededUsers.alice.id && v.online
      );
      expect(statuses.value.p2pContactStatus).toBeArrayOfSize(3);
      expect(statuses.value.groupContactStatus).toBeArrayOfSize(1);
    }
  }, 60_000);

  test("get contacts of the user");
});

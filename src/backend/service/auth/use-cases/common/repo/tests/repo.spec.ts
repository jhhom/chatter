/// <reference types="jest-extended" />
import { drizzle } from "drizzle-orm/node-postgres";
import { expect, describe, test, beforeAll } from "vitest";
import { Pool } from "pg";
import { InferModel, sql } from "drizzle-orm";

import { testUtil } from "../../../../../test-utils";
import { findOneUser } from "../repo";

const config = {
  DB_URL: "postgres://dbuser:dbuser@localhost/tinode_clone_test",
  JWT_KEY: "xxx-xxx",
};

const db = drizzle(new Pool({ connectionString: config.DB_URL }), {
  logger: true,
});

describe("Auth", async () => {
  test("get one user", async () => {
    // 1. ARRANGE
    await db.execute(
      sql`TRUNCATE TABLE users, topics, subscriptions, messages RESTART IDENTITY CASCADE;`
    );

    const seedResult = await testUtil.seed(db);
    if (seedResult.isErr()) {
      throw seedResult.error;
    }
    const [seededUsers, _, group] = seedResult.value;

    const carolResult = await findOneUser(
      { db },
      {
        username: seededUsers.carol.username,
      }
    );
    if (carolResult.isErr()) {
      throw carolResult.error;
    }
    expect(carolResult.value.subscribedGroupTopicIds).toBeArrayOfSize(1);
    expect(carolResult.value.subscribedGroupTopicIds).toContain(group.topic.id);

    const bobResult = await findOneUser(
      { db },
      { username: seededUsers.bob.username }
    );
    if (bobResult.isErr()) {
      throw bobResult.error;
    }
    expect(bobResult.value.subscribedGroupTopicIds).toBeArrayOfSize(1);
    expect(bobResult.value.subscribedGroupTopicIds).toContain(group.topic.id);

    const frankResult = await findOneUser(
      { db },
      { username: seededUsers.frank.username }
    );
    if (frankResult.isErr()) {
      throw frankResult.error;
    }
    expect(frankResult.value.subscribedGroupTopicIds).toBeArrayOfSize(0);
  });
});

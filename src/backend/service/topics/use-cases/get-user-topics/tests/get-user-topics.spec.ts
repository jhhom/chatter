/// <reference types="jest-extended" />
import { drizzle } from "drizzle-orm/node-postgres";
import { expect, describe, test } from "vitest";
import { Pool } from "pg";
import { InferModel, sql } from "drizzle-orm";
import { faker } from "@faker-js/faker";

import { users } from "~/backend/drizzle/schema";
import { testUtil } from "~/backend/service/test-utils";
import * as schema from "~/backend/drizzle/schema";

import { getTopicsOfUser } from "../get-user-topics";

const config = {
  DB_URL: "postgres://dbuser:dbuser@localhost/tinode_clone_test",
  JWT_KEY: "xxx-xxx",
};

const db = drizzle(new Pool({ connectionString: config.DB_URL }), {
  logger: true,
  schema,
});

describe("Topic", () => {
  test("get topics of user", async () => {
    // 1. ARRANGE
    await db.execute(
      sql`TRUNCATE TABLE users, topics, messages RESTART IDENTITY CASCADE;`
    );

    const seedResult = await testUtil.seed(db);
    if (seedResult.isErr()) {
      throw seedResult.error;
    }
    const [seededUsers, _, seededGroup] = seedResult.value;

    {
      const result = await getTopicsOfUser(
        { db },
        { userId: seededUsers.carol.id }
      );
      if (result.isErr()) {
        throw result.error;
      }
      expect(result.value).toBeArrayOfSize(4);
      expect(result.value).toSatisfyAny(
        (v) => v.topicId == seededUsers.frank.id
      );
      expect(result.value).toSatisfyAny(
        (v) => v.topicId == seededUsers.alice.id
      );
      expect(result.value).toSatisfyAny((v) => v.topicId == seededUsers.eve.id);
      expect(result.value).toSatisfyAny(
        (v) => v.topicId == seededGroup.topic.id
      );
    }

    {
      const result = await getTopicsOfUser(
        { db },
        { userId: seededUsers.alice.id }
      );
      if (result.isErr()) {
        throw result.error;
      }
      expect(result.value).toBeArrayOfSize(1);
    }
  }, 60_000);

  test("rollback", async () => {
    const tx = await db.transaction(async (t) => {
      await db.insert(users).values({
        id: `usr${faker.random.alphaNumeric(12)}`,
        username: "haha",
        fullname: "lol1",
        email: "lol@email.com",
        password: "1234",
        passwordHash: "12344",
        defaultPermissions: "",
      });
      throw new Error("KABBOM");
    });
  });
});

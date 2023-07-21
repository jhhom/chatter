/// <reference types="jest-extended" />
import { drizzle } from "drizzle-orm/node-postgres";
import { expect, describe, test } from "vitest";
import { Pool } from "pg";
import { sql } from "drizzle-orm";
import getMessages from "../get-messages";

import { testUtil } from "../../../../test-utils";

const config = {
  DB_URL: "postgres://dbuser:dbuser@localhost/tinode_clone_test",
  JWT_KEY: "xxx-xxx",
};

const db = drizzle(new Pool({ connectionString: config.DB_URL }), {
  logger: false,
});

describe("Topic", () => {
  test("get messages", async () => {
    // 1. ARRANGE
    await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE;`);

    const seedResult = await testUtil.seed(db);
    if (seedResult.isErr()) {
      throw seedResult.error;
    }
    const [seededUsers, _] = seedResult.value;

    {
      const result = await getMessages(
        { db },
        {
          requesterUserId: seededUsers.alice.id,
          topicId: seededUsers.carol.id,
          beforeSequenceId: -1,
          numberOfMessages: 32,
        }
      );
      if (result.isErr()) {
        throw result.error;
      }

      expect(result.value.hasEarlierMessages).toBeFalsy();
      expect(result.value.msgs.length).toBeLessThanOrEqual(32);

      const last2Message = result.value.msgs[result.value.msgs.length - 2];
      expect(last2Message.content == "Great, can't wait!");
      expect(last2Message.author).toBe(seededUsers.alice.id);
      expect(last2Message.read).toBeFalsy();
    }

    {
      const result = await getMessages(
        { db },
        {
          requesterUserId: seededUsers.alice.id,
          topicId: seededUsers.carol.id,
          beforeSequenceId: -1,
          numberOfMessages: 2,
        }
      );
      if (result.isErr()) {
        throw result.error;
      }

      expect(result.value.hasEarlierMessages).toBeTruthy();
      expect(result.value.msgs).toBeArrayOfSize(2);

      const last2Message = result.value.msgs[1];
      expect(last2Message.content == "Great, can't wait!");
      expect(last2Message.author).toBe(seededUsers.alice.id);
      expect(last2Message.read).toBeFalsy();
    }

    {
      const result = await getMessages(
        { db },
        {
          requesterUserId: seededUsers.dave.id,
          topicId: seededUsers.carol.id,
          beforeSequenceId: -1,
          numberOfMessages: 32,
        }
      );
      if (result.isErr()) {
        throw result.error;
      }

      expect(result.value.hasEarlierMessages).toBeFalsy();
      expect(result.value.msgs).toBeArrayOfSize(0);
    }

    {
      const result = await getMessages(
        { db },
        {
          requesterUserId: seededUsers.alice.id,
          topicId: seededUsers.carol.id,
          numberOfMessages: 8,
          beforeSequenceId: 1,
        }
      );
      if (result.isErr()) {
        throw result.error;
      }
      expect(result.value.msgs).toBeArrayOfSize(0);
      expect(result.value.hasEarlierMessages).toBeFalsy();
    }
  });
}, 120_000);

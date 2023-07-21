/// <reference types="jest-extended" />
import { drizzle } from "drizzle-orm/node-postgres";
import { expect, describe, test } from "vitest";
import { Pool } from "pg";
import { InferModel, sql } from "drizzle-orm";
import { getAllUnreadMessages } from "~/backend/service/topics/use-cases/get-unread-messages/get-unread-messages.repo";
import { updateMessageReadStatus } from "~/backend/service/topics/use-cases/update-message-read-status/update-message-read-status";
import { OnlineUsers } from "~/backend/service/common/online-users";

import { testUtil } from "~/backend/service/test-utils";
import { getTopicsOfUser } from "~/backend/service/topics/use-cases/get-user-topics/get-user-topics";
import * as schema from "~/backend/drizzle/schema";

const config = {
  DB_URL: "postgres://dbuser:dbuser@localhost/tinode_clone_test",
  JWT_KEY: "xxx-xxx",
};

const db = drizzle(new Pool({ connectionString: config.DB_URL }), {
  schema,
  logger: true,
});

describe("Topic", () => {
  test("get unread messages", async () => {
    // 1. ARRANGE
    await db.execute(
      sql`TRUNCATE TABLE users, topics, messages RESTART IDENTITY CASCADE;`
    );

    const seedResult = await testUtil.seed(db);
    if (seedResult.isErr()) {
      throw seedResult.error;
    }
    const [seededUsers, seededMessages] = seedResult.value;

    // 2. ACT
    // 2.1 GET ALL UNREAD MESSAGES OF CAROL
    {
      const result = await getAllUnreadMessages(db, {
        userId: seededUsers.carol.id,
      });
      if (result.isErr()) {
        throw result.error;
      }

      expect(result.value.p2pTopics).toBeArrayOfSize(3);

      const aliceMessages = result.value.p2pTopics.find(
        (v) => v.topic.id == seededUsers.alice.id
      )?.messages;
      expect(aliceMessages).toBeArrayOfSize(
        seededMessages["carol-alice"].messages.length
      );
      if (aliceMessages === undefined) {
        throw new Error("alice messages is undefined");
      }

      const updateResult = await updateMessageReadStatus(
        { db, onlineUsers: new OnlineUsers() },
        {
          readSequenceId: aliceMessages[3].sequenceId,
          updaterUserId: seededUsers.carol.id,
          topicId: seededUsers.alice.id,
        }
      );
      if (updateResult.isErr()) {
        throw updateResult.error;
      }
    }

    {
      const result = await getAllUnreadMessages(db, {
        userId: seededUsers.carol.id,
      });
      if (result.isErr()) {
        throw result.error;
      }

      expect(result.value.p2pTopics).toBeArrayOfSize(3);

      const aliceMessages = result.value.p2pTopics.find(
        (v) => v.topic.id == seededUsers.alice.id
      )?.messages;
      expect(aliceMessages).toBeArrayOfSize(
        seededMessages["carol-alice"].messages.length - 4
      );
    }
  }, 60_000);

  test("get user contact", async () => {
    // 1. ARRANGE
    await db.execute(
      sql`TRUNCATE TABLE users, topics, messages RESTART IDENTITY CASCADE;`
    );

    const seedResult = await testUtil.seed(db);
    if (seedResult.isErr()) {
      throw seedResult.error;
    }
    const [seededUsers, seededMessages] = seedResult.value;

    {
      const r = await getTopicsOfUser({ db }, { userId: seededUsers.carol.id });
      if (r.isErr()) {
        throw r.error;
      }
      expect(r.value).toBeArrayOfSize(4);
    }
  });
});

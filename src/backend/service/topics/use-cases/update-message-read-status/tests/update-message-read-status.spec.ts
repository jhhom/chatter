/// <reference types="jest-extended" />
import { drizzle } from "drizzle-orm/node-postgres";
import { expect, describe, test } from "vitest";
import { Pool } from "pg";
import { InferModel, sql } from "drizzle-orm";
import { updateMessageReadStatus } from "../update-message-read-status";

import { testUtil } from "../../../../test-utils";
import { OnlineUsers } from "../../../../common/online-users";
import { getAllUnreadMessages } from "../../get-unread-messages/get-unread-messages";

const config = {
  DB_URL: "postgres://dbuser:dbuser@localhost/tinode_clone_test",
  JWT_KEY: "xxx-xxx",
};

const db = drizzle(new Pool({ connectionString: config.DB_URL }), {
  logger: true,
});

describe("Topic", () => {
  test("update message read status", async () => {
    // 1. ARRANGE
    await db.execute(
      sql`TRUNCATE TABLE users, topics, messages RESTART IDENTITY CASCADE;`
    );

    const seedResult = await testUtil.seed(db);
    if (seedResult.isErr()) {
      throw seedResult.error;
    }
    const [seededUsers, seededMessages] = seedResult.value;

    const onlineUsers = new OnlineUsers();

    // 2. ACT
    // 2.1 Login as Alice
    const aliceLoginResult = await testUtil.login(
      {
        onlineUsers,
        config: {
          DATABASE_URL: config.DB_URL,
          JWT_KEY: config.JWT_KEY,
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

    // carol update message read status
    // assert alice receive notification
    let updatedSequenceId: number;
    {
      const result = await getAllUnreadMessages(
        { db },
        { userId: seededUsers.carol.id }
      );
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

      updatedSequenceId = aliceMessages[3].sequenceId;

      const updateResult = await updateMessageReadStatus(
        { db, onlineUsers },
        {
          readSequenceId: updatedSequenceId,
          updaterUserId: seededUsers.carol.id,
          topicId: seededUsers.alice.id,
        }
      );
      if (updateResult.isErr()) {
        throw updateResult.error;
      }
    }

    {
      const lastReceived = alice.emitter.lastReceived();
      if (lastReceived == undefined) {
        throw new Error("alice didnt receive any message");
      }

      if (lastReceived.event != "read") {
        throw new Error("last received message is not read notification");
      }

      expect(lastReceived.payload.topicUserId).toBe(seededUsers.carol.id);
      expect(lastReceived.payload.lastReadSeqId).toBe(updatedSequenceId);
    }
  }, 60_000);
});

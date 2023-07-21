/// <reference types="jest-extended" />
import { drizzle } from "drizzle-orm/node-postgres";
import { expect, describe, test } from "vitest";
import { Pool } from "pg";
import { InferModel, sql } from "drizzle-orm";

import { messages } from "../../../../../drizzle/schema";
import { testUtil } from "../../../test-utils";
import { OnlineUsers } from "../../../common/online-users";
import { sendMessage } from "../send-message/send-message";
import { forwardMessage } from "./forward-message";

const config = {
  DB_URL: "postgres://dbuser:dbuser@localhost/tinode_clone_test",
  JWT_KEY: "xxx-xxx",
  PROJECT_ROOT:
    "/Users/joohom/Documents/Projects/SideProjects/tinode/tinode-clone/tinode-clone-3",
};

const db = drizzle(new Pool({ connectionString: config.DB_URL }), {
  logger: true,
});

describe("Topic", () => {
  test("Forward message", async () => {
    // 1. Login as Alice
    // 2. Login as Carol
    // 3. Login as Dave
    // 4. Get one message from alice-carol topic, have Carol forward it to Dave
    // 5. Dave should receive notification from Carol, with content matching, but forwarded as true

    // 1. ARRANGE
    await db.execute(
      sql`TRUNCATE TABLE users, topics, messages, subscriptions RESTART IDENTITY CASCADE;`
    );

    const seedResult = await testUtil.seed(db);
    if (seedResult.isErr()) {
      throw seedResult.error;
    }
    const [seededUsers, _] = seedResult.value;

    const onlineUsers = new OnlineUsers();

    // 2. ACT
    // 2.1 Login as Alice
    const alice = await (async () => {
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
      return aliceLoginResult.value;
    })();

    // 2.2 Login as Carol
    const carol = await (async () => {
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
      return carolLoginResult.value;
    })();

    // 2.3 Login as Dave
    const dave = await (async () => {
      const daveLoginResult = await testUtil.login(
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
          username: seededUsers.dave.username,
          password: seededUsers.dave.password,
        }
      );
      if (daveLoginResult.isErr()) {
        throw daveLoginResult.error;
      }
      return daveLoginResult.value;
    })();

    // 2.4 Alice send a message to Carol
    const sent = await (async () => {
      const sent = await sendMessage(
        { db, currentOnlineUsers: onlineUsers },
        {
          content: { type: "text", content: "Hello Carol" },
          topicId: seededUsers.carol.id,
          authorId: seededUsers.alice.id,
        },
        {
          projectRoot: config.PROJECT_ROOT,
        }
      );
      if (sent.isErr()) {
        throw new Error(`Failed to send message to carol ${sent.error}`);
      }
      return sent.value;
    })();

    // 2.5 Carol forward the message received from Alice to Dave
    const forwarded = await (async () => {
      const r = await forwardMessage(
        { db, onlineUsers },
        {
          forwarder: seededUsers.carol.id,
          forwardedTo: seededUsers.dave.id,
          forwardedMessage: {
            seqId: sent.sequenceId,
            topicId: seededUsers.alice.id,
          },
        }
      );
      if (r.isErr()) {
        throw new Error(`Failed to forward message to Dave ${r.error}`);
      }
      if (r.value.content == null) {
        throw new Error(`Shouldnt be null`);
      }
      expect(r.value.content.forwarded).toBeTruthy();
      expect(
        r.value.content.type == "text" &&
          r.value.content.content == "Hello Carol"
      ).toBeTruthy();
      return r.value;
    })();

    // 3. ASSERT
    {
      const msg = dave.emitter.lastReceivedNotificationByEvent("message");
      if (msg === undefined) {
        throw new Error("dave last message is undefined");
      }
      expect(msg.payload.authorId).toBe(seededUsers.carol.id);
      expect(msg.payload.content.forwarded).toBeTruthy();
      expect(
        msg.payload.content.type == "text" &&
          msg.payload.content.content == "Hello Carol"
      );
    }
  }, 60_000);
});

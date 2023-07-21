/// <reference types="jest-extended" />
import { drizzle } from "drizzle-orm/node-postgres";
import { expect, describe, test } from "vitest";
import { Pool } from "pg";
import { InferModel, sql } from "drizzle-orm";

import { sendMessage } from "~/backend/service/topics/use-cases/send-message/send-message";
import { getP2PTopicProfile } from "~/backend/service/topics/common/repo";
import { OnlineUsers } from "~/backend/service/common/online-users";
import { testUtil } from "~/backend/service/test-utils";
import { getAllUnreadMessages } from "~/backend/service/topics/use-cases/get-unread-messages/get-unread-messages.repo";
import * as schema from "~/backend/drizzle/schema";

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
  test("get p2p topic profile", async () => {
    await db.execute(
      sql`TRUNCATE TABLE users, topics, messages, subscriptions RESTART IDENTITY CASCADE;`
    );

    const seedResult = await testUtil.seed(db);
    if (seedResult.isErr()) {
      throw seedResult.error;
    }
    const [seededUsers, _] = seedResult.value;

    const r = await getP2PTopicProfile(db, {
      user1Id: seededUsers.carol.id,
      user2Id: seededUsers.frank.id,
    });
    if (r.isErr()) {
      throw r.error;
    }
    console.log(r.value);
  });

  test("send message", async () => {
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
      const statuses = await sendMessage(
        { db, currentOnlineUsers: onlineUsers },
        {
          content: { type: "text", content: "Good evening alice" },
          topicId: seededUsers.alice.id,
          authorId: seededUsers.carol.id,
        },
        {
          projectRoot: config.PROJECT_ROOT,
        }
      );
      if (statuses.isErr()) {
        throw statuses.error;
      }

      const lastMsg = alice.emitter.lastReceived();
      if (lastMsg === undefined) {
        throw new Error("alice last message is undefined");
      }
      if (lastMsg.event != "message") {
        throw new Error("last received event is not message");
      }
      expect(lastMsg.payload.authorId).toBe(seededUsers.carol.id);
      if (lastMsg.payload.content.type != "text") {
        throw new Error("last received message is not text");
      }
      expect(lastMsg.payload.content.content).toBe("Good evening alice");
    }

    {
      const result = await getAllUnreadMessages(db, {
        userId: seededUsers.alice.id,
      });
      if (result.isErr()) {
        throw result.error;
      }

      const carolMessages = result.value.p2pTopics.find(
        (v) => v.topic.id == seededUsers.carol.id
      )?.messages;
      if (carolMessages === undefined) {
        throw new Error("carol messages are undefined");
      }

      const messageFromCarol = carolMessages[carolMessages.length - 1];
      if (messageFromCarol.content.type != "text") {
        throw new Error("Message received is text");
      }
      expect(messageFromCarol.content.content).toBe("Good evening alice");
    }

    {
      const sendResult = await sendMessage(
        { db, currentOnlineUsers: onlineUsers },
        {
          content: { type: "text", content: "Hello dave" },
          topicId: seededUsers.dave.id,
          authorId: seededUsers.carol.id,
        },
        {
          projectRoot: config.PROJECT_ROOT,
        }
      );
      if (sendResult.isErr()) {
        throw sendResult.error;
      }

      if (sendResult.value.type != "peer.new-topic") {
        throw new Error("No topic is created from sending the message");
      }

      expect(
        sendResult.value.createdTopicProfile.authorProfile.permissions
      ).toBe("JRWP");

      const result = await getAllUnreadMessages(db, {
        userId: seededUsers.dave.id,
      });
      if (result.isErr()) {
        throw result.error;
      }
      const carolMessages = result.value.p2pTopics.find(
        (v) => v.topic.id == seededUsers.carol.id
      )?.messages;
      if (carolMessages === undefined) {
        throw new Error("carol messages are undefined");
      }

      expect(
        carolMessages[0].content.type == "text" &&
          carolMessages[0].content.content == "Hello dave"
      );
    }
  }, 60_000);
});

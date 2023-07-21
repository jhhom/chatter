/// <reference types="jest-extended" />
import { drizzle } from "drizzle-orm/node-postgres";
import { expect, describe, test } from "vitest";
import { Pool } from "pg";
import { InferModel, sql } from "drizzle-orm";

import { testUtil } from "~/backend/service/test-utils";
import { getUserTopics } from "~/backend/service/topics/use-cases/get-user-topics/get-user-topics.repo";
import { OnlineUsers } from "~/backend/service/common/online-users";
import { getContactStatus } from "~/backend/service/topics/use-cases/get-contact-status/get-contact-status";
import {
  subscribeToGroupTopicNotifications,
  unsubscribeFromGroupTopicNotifications,
} from "~/backend/service/topics/use-cases/subscribe-group-topic-notifications/subscribe-group-topic-notifications";
import * as schema from "~/backend/drizzle/schema";
import { logout } from "~/backend/service/auth/use-cases/logout/logout";

const config = {
  DB_URL: "postgres://dbuser:dbuser@localhost/tinode_clone_test",
  JWT_KEY: "xxx-xxx",
};

const db = drizzle(new Pool({ connectionString: config.DB_URL }), {
  logger: true,
  schema,
});

describe("Topic", () => {
  test("get user topics", async () => {
    await db.execute(
      sql`TRUNCATE TABLE users, topics, subscriptions, messages RESTART IDENTITY CASCADE;`
    );

    const seedResult = await testUtil.seed(db);
    if (seedResult.isErr()) {
      throw seedResult.error;
    }
    const [seededUsers, _] = seedResult.value;

    const t = await getUserTopics({ db }, { userId: seededUsers.carol.id });
    if (t.isErr()) {
      throw t.error;
    }
    console.log(t.value);
  }, 50_000);

  test("group topic notification", async () => {
    // 1. ARRANGE
    await db.execute(
      sql`TRUNCATE TABLE users, topics, subscriptions, messages RESTART IDENTITY CASCADE;`
    );

    const seedResult = await testUtil.seed(db);
    if (seedResult.isErr()) {
      throw seedResult.error;
    }
    const [seededUsers, _, seededGroup] = seedResult.value;
    const onlineUsers = new OnlineUsers();

    const login = async (username: string, password: string) => {
      const r = await testUtil.login(
        {
          onlineUsers,
          config: {
            DATABASE_URL: config.DB_URL,
            JWT_KEY: config.JWT_KEY,
            PROJECT_ROOT: "",
          },
          db,
        },
        { username, password }
      );
      if (r.isErr()) {
        throw new Error(
          `failed to login as ${username}: ${JSON.stringify(r.error)}`
        );
      }
      return r.value;
    };

    // for the test, since we want to focus on that group topic only
    // 🔴 None of the members 'ken', 'dave', 'bob', should be a contact of 'carol'
    // This is so that testing is much easier, we can test group notifications received by 'carol'
    // without involving any notifications triggered by P2P topics
    // SCENARIO 1: General group online/offline notification
    // --------------------------------------------------------
    // 1. Going back to the 'HS Tutor Group 1' group scenario
    // 2. 'carol' comes online, retrieves the latest contact list and their status
    // 3. RESULT: the group should be offline, because no one other than 'carol' is online
    // 4. 'ken' comes online, 'carol' should receive a notification that the group has come online
    // 5. 'dave' comes online, 'carol' shouldn't receive any notification, because the online/offline status of the group didn't change
    // 6. 'ken' goes offline, 'carol' shouldn't receive any notification
    // 7. 'dave' goes offline, 'carol' should receive a notification that group has gone offline

    // ACT 1: Login as Carol
    const carol = await login(
      seededUsers.carol.username,
      seededUsers.carol.password
    );

    // ACT 2: Carol retrieve contact list & statuses, group topic should be offline
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
      expect(result.value.groupContactStatus).toBeArrayOfSize(1);
      expect(result.value.groupContactStatus).toSatisfyAny(
        (v) => v.online == false
      );
    }

    // ACT 3: Login as Ken
    const ken = await login(seededUsers.ken.username, seededUsers.ken.password);

    // EXPECT 1: Carol receive a group online notification
    {
      const lastReceived = carol.emitter.lastReceived();
      if (lastReceived === undefined) {
        throw new Error("last received is undefined");
      }
      if (lastReceived.event != "notification.on") {
        throw new Error("last notification is not user on");
      }
      expect(lastReceived.payload.topicId).toBe(seededGroup.topic.id);
    }

    // ACT 4: Login as Dave
    const dave = await (async () => {
      const beforeNumberOfMessages = carol.emitter.receivedMessages.length;

      const dave = await login(
        seededUsers.dave.username,
        seededUsers.dave.password
      );

      // EXPECT 2: Carol didn't receive any group online notification
      expect(carol.emitter.receivedMessages.length).toBe(
        beforeNumberOfMessages
      );

      return dave;
    })();

    // ACT 5: Ken log out
    {
      const beforeNumberOfMessages = carol.emitter.receivedMessages.length;

      const result = await logout(
        { db, onlineUsers },
        {
          ctx: ken.ctx,
        }
      );
      if (result.isErr()) {
        throw result.error;
      }

      // EXPECT 3: Carol didn't receive any group offline notification
      expect(carol.emitter.receivedMessages.length).toBe(
        beforeNumberOfMessages
      );
    }

    // ACT 6: Dave log out
    {
      const result = await logout(
        { db, onlineUsers },
        {
          ctx: dave.ctx,
        }
      );
      if (result.isErr()) {
        throw result.error;
      }
    }

    // EXPECT 4: Carol receive a group offline notification
    {
      const lastReceived = carol.emitter.lastReceived();
      if (lastReceived === undefined) {
        throw new Error("last received is undefined");
      }
      if (lastReceived.event != "notification.off") {
        throw new Error("last notification is not user off");
      }
      expect(lastReceived.payload.topicId).toBe(seededGroup.topic.id);
    }
  }, 60_000);

  test("group topic notification when user is subscribed", async () => {
    // 1. ARRANGE
    await db.execute(
      sql`TRUNCATE TABLE users, topics, subscriptions, messages RESTART IDENTITY CASCADE;`
    );

    const seedResult = await testUtil.seed(db);
    if (seedResult.isErr()) {
      throw seedResult.error;
    }
    const [seededUsers, _, seededGroup] = seedResult.value;
    const onlineUsers = new OnlineUsers();

    const login = async (username: string, password: string) => {
      const r = await testUtil.login(
        {
          onlineUsers,
          config: {
            DATABASE_URL: config.DB_URL,
            JWT_KEY: config.JWT_KEY,
            PROJECT_ROOT: "",
          },
          db,
        },
        { username, password }
      );
      if (r.isErr()) {
        throw new Error(
          `failed to login as ${username}: ${JSON.stringify(r.error)}`
        );
      }
      return r.value;
    };

    // SCENARIO 2: When 'carol' is looking at the group
    // --------------------------------------------------------
    // DESCRIPTION: When 'carol' is looking at the group, they should make a subscription to receive more detailed online/offline notifications
    // Where the notification content tells who is the latest online users
    // --------------------------------------------------------
    // Going back to the 'HS Tutor Group 1' group scenario
    //
    // 1. 'carol' comes online
    //
    // 2. 'bob' comes online, 'carol' should receive 1 notification
    //    - Notification: Group has changed to online
    //
    // 3. 'carol' makes a subscription to 'HS Tutor Group 1' topic
    //
    // 4. 'ken' comes online, 'carol' should receive 1 notification
    //    - Notification: Changes on group online members: ['ken', 'carol', 'bob]
    //
    // 5. 'ken' goes offline, 'carol' should receive 1 notifications
    //    - Notification: Changes on group online members: ['carol', 'ken']
    //
    // 6. 'bob' goes offline, 'carol' should receive 2 notifications
    //    - Notification 1: Group has changed from online to offline
    //    - Notification 2: Changes on group online members: ['carol']
    //
    // 7. 'carol' unsubscribe from the group topic's online member list change notification
    //
    // 8. 'ken' comes online
    //    - carol should no longer receive detailed notification
    //    - carol should still receive a status change notification for the group as a whole

    // ACT 1: Login as Carol
    const carol = await login(
      seededUsers.carol.username,
      seededUsers.carol.password
    );

    // ACT 2: Login as Bob
    const bob = await login(seededUsers.bob.username, seededUsers.bob.password);

    {
      const m = carol.emitter.lastReceived();
      if (m == undefined) {
        throw new Error("carol message is undefined");
      }
      if (m.event == "notification.on") {
        expect(m.payload.topicId).toBe(seededGroup.topic.id);
      } else {
        throw new Error("last notification is not on");
      }
    }

    // ACT 3: Carol subscribe to receive online member list changes notification on group topic
    subscribeToGroupTopicNotifications(
      { onlineUsers },
      { subscriberId: seededUsers.carol.id, groupTopicId: seededGroup.topic.id }
    );

    // ACT 4: Login as Ken
    //
    // Carol should receive notifications
    const ken = await login(seededUsers.ken.username, seededUsers.ken.password);
    {
      const m = carol.emitter.lastReceived();
      if (m == undefined) {
        throw new Error("carol message is undefined");
      }
      if (m.event != "group-chat-notification.online-members") {
        throw new Error("event is not group chat notification");
      }
      expect(m.payload.topicId).toBe(seededGroup.topic.id);
      expect(m.payload.onlineMembers).toContainAllValues([
        seededUsers.bob.id,
        seededUsers.carol.id,
        seededUsers.ken.id,
      ]);
      expect(m.payload.onlineMembers).toBeArrayOfSize(3);
    }

    // ACT 5: Logout as Ken
    //
    // Carol should receive notification again
    await logout({ db, onlineUsers }, { ctx: ken.ctx });
    {
      const m = carol.emitter.lastReceived();
      if (m == undefined) {
        throw new Error("carol message is undefined");
      }
      if (m.event != "group-chat-notification.online-members") {
        throw new Error("event is not group chat notification");
      }
      expect(m.payload.topicId).toBe(seededGroup.topic.id);
      expect(m.payload.onlineMembers).toContainAllValues([
        seededUsers.bob.id,
        seededUsers.carol.id,
      ]);
      expect(m.payload.onlineMembers).toBeArrayOfSize(2);
    }

    // ACT 6: Logout as Bob
    //
    // Carol should receive 2 notifications
    // - group topic status change
    // - online member list change
    await logout({ db, onlineUsers }, { ctx: bob.ctx });
    {
      const m = carol.emitter.lastReceivedNotificationByEvent(
        "group-chat-notification.online-members"
      );
      if (m == undefined) {
        throw new Error("carol message is undefined");
      }
      expect(m.payload.topicId).toBe(seededGroup.topic.id);
      expect(m.payload.onlineMembers).toContainAllValues([
        seededUsers.carol.id,
      ]);
      expect(m.payload.onlineMembers).toBeArrayOfSize(1);
    }
    {
      const m =
        carol.emitter.lastReceivedNotificationByEvent("notification.off");
      if (m == undefined) {
        throw new Error("carol message is undefined");
      }
      expect(m.payload.topicId).toBe(seededGroup.topic.id);
    }

    // ACT 7: 'carol' unsubscribe from group topic's online member list change notification
    unsubscribeFromGroupTopicNotifications(
      { onlineUsers },
      { subscriberId: seededUsers.carol.id, groupTopicId: seededGroup.topic.id }
    );

    // ACT 8: 'ken' comes online
    {
      const beforeNumberOfMessagesReceived =
        carol.emitter.receivedMessages.length;
      await login(seededUsers.ken.username, seededUsers.ken.password);

      expect(carol.emitter.receivedMessages.length).toBe(
        beforeNumberOfMessagesReceived + 1
      );

      const m = carol.emitter.lastReceived();
      if (m == undefined) {
        throw new Error("carol message is undefined");
      }
      if (m.event != "notification.on") {
        throw new Error("event is not group chat notification");
      }
      expect(m.payload.topicId).toBe(seededGroup.topic.id);
    }
  }, 60_000);
});

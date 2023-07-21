/// <reference types="jest-extended" />
import { drizzle } from "drizzle-orm/node-postgres";
import { expect, describe, test } from "vitest";
import { Pool } from "pg";
import { InferModel, sql } from "drizzle-orm";
import { OnlineUsers } from "~/backend/service/common/online-users";
import { testUtil } from "~/backend/service/test-utils";
import * as schema from "~/backend/drizzle/schema";
import type { Socket } from "~/backend/router/socket";

const config = {
  DB_URL: "postgres://dbuser:dbuser@localhost/tinode_clone_test",
  JWT_KEY: "xxx-xxx",
};

const db = drizzle(new Pool({ connectionString: config.DB_URL }), {
  logger: false,
  schema,
});

describe("OnlineUsers", () => {
  test("Test notifications", async () => {
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

    // just a dummy socket to satisfy the parameters needed for the functions
    // we don't test any values socket receive here
    const dummySocket: Socket = {
      next() {},
      error() {},
      complete() {},
    };

    const state = () => OnlineUsers._values(onlineUsers);

    {
      // 1. Alice login

      onlineUsers.add(seededUsers.alice.id, [], dummySocket);

      expect(state().onlineUsers.size).toBe(1);
      expect(state().onlineUsers.has(seededUsers.alice.id)).toBeTruthy();
    }

    const carolSocketId = (() => {
      // 2. Carol login
      //
      // Description: Carol belongs to a group
      //
      // 1. we test that the group has a new online member after Carol logins
      // 2. when a group has a new online member, other members should receive notifications
      //    - but in this case, no notification should be sent as there is no other online members

      const { socketId, toNotify: notiList } = onlineUsers.add(
        seededUsers.carol.id,
        [seededGroup.topic.id],
        dummySocket
      );
      expect(notiList).toBeArrayOfSize(0);
      expect(state().onlineUsers.size).toBe(2);
      expect(state().onlineUsers.has(seededUsers.carol.id)).toBeTruthy();

      const group = state().groups.get(seededGroup.topic.id);
      if (group == undefined) {
        throw "no group is found";
      }
      expect(group.onlineMembers.size).toBe(1);
      expect(group.onlineStatusChangeSubscribers.size).toBe(0);
      expect(state().onlineUsers.size).toBe(2);
      expect(
        onlineUsers.isGroupTopicOnline(seededGroup.topic.id).isOnline
      ).toBeFalsy();

      return socketId;
    })();

    const kenSocketId = (() => {
      // 3. Ken login
      //
      // Description: Ken is in Carol's group
      //
      // 1. we test that the group has a new online member
      // 2. a notification should be sent to Carol as the group has one online member now (other than Carol herself)

      const { socketId, toNotify: notiList } = onlineUsers.add(
        seededUsers.ken.id,
        [seededGroup.topic.id],
        dummySocket
      );
      expect(notiList).toBeArrayOfSize(1);
      expect(notiList[0].topicId).toBe(seededGroup.topic.id);
      expect(notiList[0].userId).toBe(seededUsers.carol.id);
      expect(state().onlineUsers.size).toBe(3);
      expect(
        onlineUsers.isGroupTopicOnline(seededGroup.topic.id).isOnline
      ).toBeTruthy();

      return socketId;
    })();

    const bobSocketId = (() => {
      // 4. Bob login
      //
      // Description: Bob is in Carol's group
      //
      // 1. we test that the group has a new online member
      // 2. no group online notification should be sent to anyone (as the group's status doesn't change, it stays online)

      const { socketId, toNotify: notiList } = onlineUsers.add(
        seededUsers.bob.id,
        [seededGroup.topic.id],
        dummySocket
      );
      expect(notiList).toBeArrayOfSize(0);
      expect(state().onlineUsers.size).toBe(4);
      return socketId;
    })();

    {
      // 4.1 Bob typing: Test that typing notifcation works
      const timeStartTyping = new Date();
      onlineUsers.isTyping(
        seededUsers.bob.id,
        seededGroup.topic.id,
        timeStartTyping
      );
      const bob = state().onlineUsers.get(seededUsers.bob.id);
      if (bob == undefined) {
        throw "Bob is not found";
      }

      expect(bob.typing?.topicId).toBe(seededGroup.topic.id);
      expect(bob.typing?.timeStartTyping.getTime()).toBe(
        timeStartTyping.getTime()
      );

      onlineUsers.stopTyping(seededUsers.bob.id);
      expect(bob.typing).toBeUndefined();
    }

    const daveSocketId = (() => {
      // 5. Carol starts subscribing for detailed notification, Dave login
      //
      // Description: Dave is in Carol's group
      //
      // 1. we test that group's subscribers has added Carol in it
      // 2. other tests as the same as when Bob login

      onlineUsers.subscribeUserToGroup(
        seededUsers.carol.id,
        seededGroup.topic.id
      );
      const { socketId, toNotify: notiList } = onlineUsers.add(
        seededUsers.dave.id,
        [seededGroup.topic.id],
        dummySocket
      );
      const grp = state().groups.get(seededGroup.topic.id);
      if (grp == undefined) {
        throw "Group is not found";
      }

      expect(notiList).toBeArrayOfSize(0);
      expect(state().onlineUsers.size).toBe(5);
      expect(grp.onlineStatusChangeSubscribers.size).toBe(1);

      return socketId;
    })();

    {
      // 5.1 Test sub/unsub detailed notification: Bob subscribe, then unsubscribe for detailed notification
      onlineUsers.subscribeUserToGroup(
        seededUsers.bob.id,
        seededGroup.topic.id
      );
      const grp = state().groups.get(seededGroup.topic.id);
      if (grp == undefined) {
        throw "Group is not found";
      }
      expect(grp.onlineStatusChangeSubscribers.size).toBe(2);

      onlineUsers.unsubscribeUserToGroup(
        seededUsers.bob.id,
        seededGroup.topic.id
      );
      expect(grp.onlineStatusChangeSubscribers.size).toBe(1);
    }

    {
      // 6. Ken logout
      //
      // Description: Ken is in Carol's group
      //
      // 1. we test that the group has one less online member
      // 2. no group online notification should be sent to anyone (as the group's status doesn't change, it stays online)

      const notiList = onlineUsers.remove(seededUsers.ken.id, kenSocketId);
      onlineUsers.remove(seededUsers.dave.id, daveSocketId);
      expect(notiList.toNotify).toBeArrayOfSize(0);
      expect(state().onlineUsers.size).toBe(3);

      const grp = state().groups.get(seededGroup.topic.id);
      if (grp == undefined) {
        throw "Group is not found";
      }
      expect(grp.onlineMembers.size).toBe(2);
      expect(grp.onlineStatusChangeSubscribers.size).toBe(1);
    }

    {
      // 7. Carol logout
      //
      // 1. we test that the group has one less online member
      // 2. a group online notification should be sent to Bob (the only online person in the group)

      const notiList = onlineUsers.remove(seededUsers.carol.id, carolSocketId);
      expect(state().onlineUsers.size).toBe(2);
      expect(notiList.toNotify).toBeArrayOfSize(1);
      expect(notiList.toNotify[0]).toContainAllEntries([
        ["topicId", seededGroup.topic.id],
        ["userId", seededUsers.bob.id],
      ]);
      expect(notiList.groupsUserIsRemoved).toBeArrayOfSize(1);
      expect(notiList.groupsUserIsRemoved[0]).toBe(seededGroup.topic.id);
      const grp = state().groups.get(seededGroup.topic.id);
      if (grp == undefined) {
        throw "Group is not found";
      }
      expect(grp.onlineMembers.size).toBe(1);
      expect(grp.onlineStatusChangeSubscribers.size).toBe(0);
      expect(grp.onlineMembers.size).toBe(1);
      expect(
        onlineUsers.isGroupTopicOnline(seededGroup.topic.id).isOnline
      ).toBeFalsy();
    }
  }, 50_000);

  test("group topic notification when user use multiple browsers to login", async () => {
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

    // just a dummy socket to satisfy the parameters needed for the functions
    // we don't test any values socket receive here
    const dummySocket: Socket = {
      next() {},
      error() {},
      complete() {},
    };
    const state = () => OnlineUsers._values(onlineUsers);

    const carolSocketId = (() => {
      // 1. Carol login

      const { socketId } = onlineUsers.add(
        seededUsers.carol.id,
        [seededGroup.topic.id],
        dummySocket
      );

      expect(state().onlineUsers.size).toBe(1);
      expect(state().onlineUsers.has(seededUsers.carol.id)).toBeTruthy();
      return socketId;
    })();

    const carolSocketId2 = (() => {
      // 2. Carol login a second time from a different browser

      const { socketId } = onlineUsers.add(
        seededUsers.carol.id,
        [seededGroup.topic.id],
        dummySocket
      );

      expect(state().onlineUsers.size).toBe(1);
      expect(state().onlineUsers.has(seededUsers.carol.id)).toBeTruthy();

      return socketId;
    })();

    {
      // 3. ken login
      const { socketId, toNotify: notiList } = onlineUsers.add(
        seededUsers.ken.id,
        [seededGroup.topic.id],
        dummySocket
      );
    }

    {
      // 4. carol logouts
      // when alice logout, the list for group to notify should be empty, because the number of members in the group doesn't change
      const { toNotify, groupsUserIsRemoved } = onlineUsers.remove(
        seededUsers.carol.id,
        carolSocketId2
      );

      expect(toNotify.length).toBe(0);
      expect(groupsUserIsRemoved.length).toBe(0);
    }

    {
      // 5. carol logouts again
      // this time ken should be notified that the group has gone offline
      const { toNotify, groupsUserIsRemoved } = onlineUsers.remove(
        seededUsers.carol.id,
        carolSocketId
      );

      expect(toNotify.length).toBe(1);
      expect(groupsUserIsRemoved.length).toBe(1);
    }
  }, 60_000);
});

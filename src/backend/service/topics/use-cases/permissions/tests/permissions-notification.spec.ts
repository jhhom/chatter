/// <reference types="jest-extended" />
import { drizzle } from "drizzle-orm/node-postgres";
import { expect, describe, test } from "vitest";
import { Pool } from "pg";
import { InferModel, sql } from "drizzle-orm";

import notifyIsTyping from "~/backend/service/topics/use-cases/notify-typing/notify-typing";
import { testUtil } from "~/backend/service/test-utils";
import { OnlineUsers } from "~/backend/service/common/online-users";
import { login } from "~/backend/service/test-utils/login";
import { updatePeerPermission } from "~/backend/service/topics/use-cases/permissions/permissions";
import { getContactStatus } from "~/backend/service/topics/use-cases/get-contact-status/get-contact-status";
import { logout } from "~/backend/service/auth/use-cases/logout/logout";
import { autoLogin } from "~/backend/service/auth/use-cases/auto-login/auto-login";
import * as schema from "~/backend/drizzle/schema";

const config = {
  DATABASE_URL: "postgres://dbuser:dbuser@localhost/tinode_clone_test",
  JWT_KEY: "xxx-xxx",
  PROJECT_ROOT: "",
};

const db = drizzle(new Pool({ connectionString: config.DATABASE_URL }), {
  logger: true,
  schema,
});

describe("Permission notification", () => {
  test("Permission: P2P topic subscriber without getting notified permission shouldn't receive any presence notifications", async () => {
    const setup = async () => {
      await db.execute(
        sql`TRUNCATE TABLE users, topics, messages RESTART IDENTITY CASCADE;`
      );

      const seedResult = await testUtil.seed(db);
      if (seedResult.isErr()) {
        throw seedResult.error;
      }

      const [seededUsers, _] = seedResult.value;

      const onlineUsers = new OnlineUsers();

      const r = await updatePeerPermission(db, onlineUsers, {
        newPermission: "JRW",
        requesterUserId: seededUsers.carol.id,
        peerId: seededUsers.frank.id,
      });

      if (r.isErr()) {
        throw r.error;
      }

      return {
        seededUsers,
        onlineUsers,
      };
    };

    const { seededUsers: users, onlineUsers } = await setup();

    // 0. Login as eve
    const eve = await (async () => {
      const r = await login(
        { onlineUsers, config, db },
        {
          username: users.eve.username,
          password: users.eve.password,
        }
      );
      if (r.isErr()) {
        throw r.error;
      }
      return r.value;
    })();

    // 1. Login as carol
    const carol = await (async () => {
      const r = await login(
        { onlineUsers, config, db },
        {
          username: users.carol.username,
          password: users.carol.password,
        }
      );
      if (r.isErr()) {
        throw r.error;
      }
      return r.value;
    })();

    // 2. Login as frank
    const frank = await (async () => {
      const r = await login(
        { onlineUsers, config, db },
        {
          username: users.frank.username,
          password: users.frank.password,
        }
      );
      if (r.isErr()) {
        throw r.error;
      }
      return r.value;
    })();

    // 3. EXPECT: carol should receive `frank`'s notifications...
    // 3.1 EXPECT: carol should receive a `on` notification of `frank`
    {
      const noti =
        carol.emitter.lastReceivedNotificationByEvent("notification.on");
      if (noti == undefined) {
        throw new Error("Frank didn't receive any on notification");
      }
      expect(noti.payload.topicId).toBe(frank.ctx.auth.userId);
    }

    // 3.2 EXPECT: Frank get contact status should have `carol` as `online`
    {
      const r = await getContactStatus(
        { db, onlineUsers },
        { userId: carol.ctx.auth.userId }
      );
      if (r.isErr()) {
        throw r.error;
      }
      const frankStatus = r.value.p2pContactStatus.find(
        (v) => v.topicId == users.frank.id
      );
      if (frankStatus == undefined) {
        throw new Error(`Carol didn't retrieve any status of frank`);
      }
      expect(frankStatus.topicId).toBe(frank.ctx.auth.userId);
      expect(frankStatus.online).toBeTruthy();
    }

    // 3.3 ACT, EXPECT: `frank` typing, carol should receive Typing notification
    {
      await notifyIsTyping(
        { onlineUsers, db },
        {
          action: "typing",
          notifierId: users.frank.id,
          topicId: users.carol.id,
        }
      );
      const noti = carol.emitter.lastReceivedNotificationByEvent(
        "notification.typing"
      );
      if (noti == undefined) {
        throw new Error(`Carol didn't receive typing notification`);
      }
      expect(noti.payload.topicId).toBe(users.frank.id);
    }

    // 4.0 `frank` get contact status, `carol` should be offline (even though `carol` is on)
    {
      const r = await getContactStatus(
        { db, onlineUsers },
        { userId: users.frank.id }
      );
      if (r.isErr()) {
        throw r.error;
      }
      const carol = r.value.p2pContactStatus.find(
        (x) => x.topicId == users.carol.id
      );
      if (carol == undefined) {
        throw new Error("Frank not found among Carol's contacts");
      }
      expect(carol.online).toBeFalsy();
    }

    // 4.0 (2) `eve` get contact status, `carol` should be online
    {
      const r = await getContactStatus(
        { db, onlineUsers },
        { userId: users.frank.id }
      );
      if (r.isErr()) {
        throw r.error;
      }
      const carol = r.value.p2pContactStatus.find(
        (x) => x.topicId == users.carol.id
      );
      if (carol == undefined) {
        throw new Error("Frank not found among Carol's contacts");
      }
      expect(carol.online).toBeFalsy();
    }

    // 4.1 `carol` starts typing, `frank` shouldn't receive any typing notification
    {
      await notifyIsTyping(
        { onlineUsers, db },
        {
          action: "typing",
          notifierId: users.carol.id,
          topicId: users.frank.id,
        }
      );

      const noti = frank.emitter.lastReceivedNotificationByEvent(
        "notification.typing"
      );
      expect(noti).toBeUndefined();
    }

    // 4.2 `carol` stops typing, `frank` shouldn't receive any typing notification
    {
      await notifyIsTyping(
        { onlineUsers, db },
        {
          action: "stop-typing",
          notifierId: users.carol.id,
          topicId: users.frank.id,
        }
      );
      const noti = frank.emitter.lastReceivedNotificationByEvent(
        "notification.typing"
      );
      expect(noti).toBeUndefined();
    }

    // 4.3 `carol` logs out
    // ❌ `frank` shouldn't receive a log out notification from `carol`
    // ✅ `eve` should receive
    {
      const r = await logout({ db, onlineUsers }, { ctx: carol.ctx });
      if (r.isErr()) {
        throw new Error(`Failed to logout: ${r.error}`);
      }

      const frankNoti =
        frank.emitter.lastReceivedNotificationByEvent("notification.off");
      expect(frankNoti).toBeUndefined();

      const eveNoti =
        eve.emitter.lastReceivedNotificationByEvent("notification.off");
      expect(eveNoti?.payload.topicId).toBe(users.carol.id);
    }

    // 4.4 `carol` logs in
    // ❌ `frank` shouldn't receive any online notification of `carol`
    // ✅ eve should receive
    const carolLoginSession = await (async () => {
      const r = await login(
        { onlineUsers, config, db },
        { username: users.carol.username, password: users.carol.password }
      );
      if (r.isErr()) {
        throw new Error(`Failed to login: ${r.error}`);
      }

      const frankNoti =
        frank.emitter.lastReceivedNotificationByEvent("notification.on");
      expect(frankNoti).toBeUndefined();
      const eveNoti =
        eve.emitter.lastReceivedNotificationByEvent("notification.on");
      expect(eveNoti?.payload.topicId).toBe(users.carol.id);

      return r.value;
    })();

    // 4.5 `frank` logs out, then auto-login
    // ❌ `carol` shouldn't receive any online notification from `frank`
    // ✅ eve should receive
    {
      {
        const r = await logout(
          { db, onlineUsers },
          { ctx: carolLoginSession.ctx }
        );
        if (r.isErr()) {
          throw new Error(`Failed to logout: ${r.error}`);
        }
      }

      const r = await autoLogin(
        { onlineUsers },
        {
          jwtToken: carolLoginSession.token,
          userCtx: carolLoginSession.ctx,
        }
      );
      if (r.isErr()) {
        throw new Error(`Failed to auto login: ${r.error}`);
      }

      const noti =
        frank.emitter.lastReceivedNotificationByEvent("notification.on");
      expect(noti).toBeUndefined();
      const eveNoti =
        eve.emitter.lastReceivedNotificationByEvent("notification.on");
      expect(eveNoti?.payload.topicId).toBe(users.carol.id);
    }
  }, 60_000);
});

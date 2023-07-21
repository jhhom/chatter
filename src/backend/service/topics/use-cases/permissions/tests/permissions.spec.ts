/// <reference types="jest-extended" />
import { drizzle } from "drizzle-orm/node-postgres";
import { expect, describe, test } from "vitest";
import { Pool } from "pg";
import { InferModel, sql, eq, and } from "drizzle-orm";

import { testUtil } from "~/backend/service/test-utils";
import { OnlineUsers } from "~/backend/service/common/online-users";
import * as schema from "~/backend/drizzle/schema";
import { subscriptions } from "~/backend/drizzle/schema";

import {
  getPeerPermission,
  isPermissionStringValid,
  updatePeerPermission,
} from "../permissions";

const config = {
  DB_URL: "postgres://dbuser:dbuser@localhost/tinode_clone_test",
  JWT_KEY: "xxx-xxx",
};

const db = drizzle(new Pool({ connectionString: config.DB_URL }), {
  logger: true,
  schema,
});

describe("Topic", () => {
  test("get peer permission", async () => {
    // 1. ARRANGE
    await db.execute(
      sql`TRUNCATE TABLE users, topics, messages, subscriptions RESTART IDENTITY CASCADE;`
    );

    const seedResult = await testUtil.seed(db);
    if (seedResult.isErr()) {
      throw seedResult.error;
    }

    const [user, topic, __] = seedResult.value;

    // 1.1 update carol's permission in `carol-alice` topic
    await db
      .update(subscriptions)
      .set({
        permissions: "JR",
      })
      .where(
        and(
          eq(subscriptions.userId, user.carol.id),
          eq(subscriptions.topicId, topic["carol-alice"].topicId!)
        )
      );

    {
      const p = await getPeerPermission(db, {
        requesterUserId: user.alice.id,
        peerId: user.carol.id,
      });
      if (p.isErr()) {
        throw p.error;
      }
      expect(p.value.permissions).toBe("JR");
    }
  }, 60_000);

  test("update peer permission", async () => {
    // 1. ARRANGE
    await db.execute(
      sql`TRUNCATE TABLE users, topics, messages, subscriptions RESTART IDENTITY CASCADE;`
    );

    const seedResult = await testUtil.seed(db);
    if (seedResult.isErr()) {
      throw seedResult.error;
    }

    const [user, topic, __] = seedResult.value;
    const onlineUsers = new OnlineUsers();

    {
      const r = await updatePeerPermission(db, onlineUsers, {
        newPermission: "JR",
        requesterUserId: user.alice.id,
        peerId: user.carol.id,
      });
      if (r.isErr()) {
        throw r.error;
      }
      expect(r.value.permissions).toBe("JR");
    }

    {
      const p = await getPeerPermission(db, {
        requesterUserId: user.alice.id,
        peerId: user.carol.id,
      });
      if (p.isErr()) {
        throw p.error;
      }
      expect(p.value.permissions).toBe("JR");
    }
  }, 60_000);

  test("permission validation", () => {
    expect(isPermissionStringValid("")).toBeTruthy();
    expect(isPermissionStringValid("JRW")).toBeTruthy();
    expect(isPermissionStringValid("JR")).toBeTruthy();

    expect(isPermissionStringValid("JB")).toBeFalsy();
    expect(isPermissionStringValid("JRJ")).toBeFalsy();
    expect(isPermissionStringValid("ABC")).toBeFalsy();
    expect(isPermissionStringValid("JRWJ")).toBeFalsy();
  });
});

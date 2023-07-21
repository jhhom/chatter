import { fromPromise, ok, err } from "neverthrow";
import { DateTime } from "luxon";
import { eq, and, inArray, not, like } from "drizzle-orm";

import {
  topics,
  users,
  subscriptions,
  groupTopicMeta,
  UserId,
  GroupTopicId,
} from "~/backend/drizzle/schema";
import { AppPgDatabase } from "~/backend/drizzle/db";


export async function getUserContact(
  ctx: { db: AppPgDatabase },
  input: { userId: UserId }
) {
  const p2pTopics = await fromPromise(
    ctx.db
      .select({
        name: users.fullname,
        topicId: users.id,
        touchedAt: topics.touchedAt,
        lastOnline: users.lastOnline,
      })
      .from(topics)
      .innerJoin(subscriptions, eq(subscriptions.topicId, topics.id))
      .innerJoin(users, eq(subscriptions.userId, users.id))
      .where(
        and(
          not(eq(subscriptions.userId, input.userId)),
          like(subscriptions.topicId, "p2p%")
        )
      ),
    (e) => e
  ).map((v) =>
    v.map((i) => ({
      ...i,
      touchedAt: i.touchedAt
        ? DateTime.fromSQL(i.touchedAt, { zone: "utc" }).toJSDate()
        : null,
      lastOnline: i.lastOnline
        ? DateTime.fromSQL(i.lastOnline, { zone: "utc" }).toJSDate()
        : null,
    }))
  );
  if (p2pTopics.isErr()) {
    return err(p2pTopics.error);
  }

  const grpTopics = await fromPromise(
    ctx.db
      .select({
        name: groupTopicMeta.groupName,
        topicId: topics.id,
        touchedAt: topics.touchedAt,
      })
      .from(topics)
      .innerJoin(subscriptions, eq(subscriptions.topicId, topics.id))
      .innerJoin(groupTopicMeta, eq(groupTopicMeta.topicId, topics.id))
      .where(
        and(like(topics.id, "grp%"), eq(subscriptions.userId, input.userId))
      ),
    (e) => e
  ).map((v) =>
    v.map((i) => ({
      name: i.name,
      topicId: i.topicId as GroupTopicId,
      touchedAt: i.touchedAt
        ? DateTime.fromSQL(i.touchedAt, { zone: "utc" }).toJSDate()
        : null,
    }))
  );
  if (grpTopics.isErr()) {
    return err(grpTopics.error);
  }

  return ok({
    groupTopics: grpTopics.value,
    p2pTopics: p2pTopics.value,
  });
}

export async function getUserLastOnline(
  db: AppPgDatabase,
  arg: {
    userId: UserId;
  }
) {
  const lastOnlineResult = await fromPromise(
    db
      .select({ lastOnline: users.lastOnline })
      .from(users)
      .where(eq(users.id, arg.userId)),
    (e) => e
  );
  if (lastOnlineResult.isErr()) {
    return err(lastOnlineResult.error);
  }
  if (lastOnlineResult.value.length == 0) {
    return err(new Error("No user found"));
  }
  const lastOnlineS = lastOnlineResult.value[0].lastOnline;
  const lastOnline = lastOnlineS ? new Date(lastOnlineS) : null;
  return ok(lastOnline);
}

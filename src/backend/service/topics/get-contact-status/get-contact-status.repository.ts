import { fromPromise, ok, err } from "neverthrow";

import { UserId } from "~/api-contract/subscription/subscription";
import { KyselyDB } from "~/backend/schema";

export async function getUserContact(db: KyselyDB, userId: UserId) {
  const p2pTopics = await fromPromise(
    db
      .selectFrom("topics")
      .innerJoin("subscriptions", (join) =>
        join.onRef("subscriptions.topicId", "=", "topics.id")
      )
      .innerJoin("users", (join) =>
        join.onRef("subscriptions.userId", "=", "users.id")
      )
      .select([
        "users.fullname as name",
        "users.id as topicId",
        "topics.touchedAt",
        "users.lastOnline",
      ])
      .where("subscriptions.topicId", "like", "p2p%")
      .where(({ eb, not }) => not(eb("subscriptions.userId", "=", userId)))
      .execute(),
    (e) => e
  );
  if (p2pTopics.isErr()) {
    return err(p2pTopics.error);
  }

  const grpTopics = await fromPromise(
    db
      .selectFrom("topics")
      .innerJoin("subscriptions", "subscriptions.topicId", "topics.id")
      .innerJoin("groupTopicMeta", "groupTopicMeta.topicId", "topics.id")
      .select([
        "groupTopicMeta.groupName as name",
        "groupTopicMeta.topicId",
        "topics.touchedAt",
      ])
      .where("topics.id", "like", "grp%")
      .where("subscriptions.userId", "=", userId)
      .execute(),
    (e) => e
  );
  if (grpTopics.isErr()) {
    return err(grpTopics.error);
  }

  return ok({
    p2pTopics: p2pTopics.value,
    groupTopics: grpTopics.value,
  });
}

export async function getUserLastOnline(db: KyselyDB, userId: UserId) {
  const r = await fromPromise(
    db
      .selectFrom("users")
      .select("users.lastOnline")
      .where("users.id", "=", userId)
      .executeTakeFirstOrThrow(),
    (e) => e
  );
  if (r.isErr()) {
    return err(r.error);
  }
  return ok(r.value.lastOnline);
}

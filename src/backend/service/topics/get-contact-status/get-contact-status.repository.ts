import { fromPromise, ok, err } from "neverthrow";

import { UserId } from "~/api-contract/subscription/subscription";
import { KyselyDB } from "~/backend/schema";

// this is wrong
// this is getting all p2p contacts that user is not part of
// we want to get all p2p contacts that user is part of
// but we want to not get the profile of the user
// try with user james see
// james user id: usrhagljd4igks8
export async function getUserContact(db: KyselyDB, userId: UserId) {
  const p2pTopics = await fromPromise(
    db
      .selectFrom("topics")
      .innerJoin("subscriptions as peerSub", (join) =>
        join
          .onRef("peerSub.topicId", "=", "topics.id")
          .on("peerSub.userId", "!=", userId)
      )
      .innerJoin("subscriptions as userSub", (join) =>
        join
          .onRef("userSub.topicId", "=", "topics.id")
          .on("userSub.userId", "=", userId)
      )
      .innerJoin("users", (join) =>
        join.onRef("peerSub.userId", "=", "users.id")
      )
      .select([
        "users.fullname as name",
        "users.id as topicId",
        "topics.touchedAt",
        "users.lastOnline",
      ])
      .where("topics.id", "like", "p2p%")
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

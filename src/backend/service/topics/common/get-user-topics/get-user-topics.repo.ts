import { KyselyDB } from "~/backend/schema";
import {
  GroupTopicId,
  UserId,
  P2PTopicId,
} from "~/api-contract/subscription/subscription";
import { completeMediaUrl } from "~/backend/service/common/media";
import { ValuesType } from "utility-types";
import { fromPromise, err, ok } from "neverthrow";
import { sql } from "kysely";

export async function getGroupTopics(db: KyselyDB, userId: UserId) {
  const grpTopicsResult = await fromPromise(
    db
      .selectFrom("topics")
      .innerJoin("subscriptions", "subscriptions.topicId", "topics.id")
      .innerJoin("groupTopicMeta", "groupTopicMeta.topicId", "topics.id")
      .select([
        "topics.id as topicId",
        "groupTopicMeta.groupName as topicName",
        "groupTopicMeta.profilePhotoUrl",
        "topics.touchedAt",
        "subscriptions.permissions as userPermissions",
        "groupTopicMeta.defaultPermissions",
        "groupTopicMeta.ownerId",
      ])
      .where("topics.id", "like", "grp%")
      .where("subscriptions.userId", "=", userId)
      .execute(),
    (e) => e
  ).map((t) =>
    t.map((_t) => ({
      topicId: _t.topicId as GroupTopicId,
      topicName: _t.topicName,
      touchedAt: _t.touchedAt ? new Date(_t.touchedAt) : null,
      profilePhotoUrl: _t.profilePhotoUrl
        ? completeMediaUrl(_t.profilePhotoUrl)
        : null,
      ownerId: _t.ownerId,
      userPermissions: _t.userPermissions,
      defaultPermissions: _t.defaultPermissions,
    }))
  );
  if (grpTopicsResult.isErr()) {
    return err(grpTopicsResult.error);
  }

  const grpTopics: (ValuesType<typeof grpTopicsResult.value> & {
    touchedAt: Date | null;
  })[] = [];

  for (const t of grpTopicsResult.value) {
    const touchedAtResult = await fromPromise(
      db
        .selectFrom("messages")
        .select("createdAt")
        .where("messages.topicId", "=", t.topicId)
        .orderBy("messages.sequenceId", "desc")
        .limit(1)
        .executeTakeFirst(),
      (e) => e
    );
    if (touchedAtResult.isErr()) {
      return err(touchedAtResult.error);
    }
    const touchedAt =
      touchedAtResult.value === undefined
        ? null
        : new Date(touchedAtResult.value.createdAt);
    grpTopics.push({
      ...t,
      touchedAt,
    });
  }
  return ok(grpTopics);
}

export async function getP2PTopics(db: KyselyDB, userId: UserId) {
  const p2pTopicsResult = await fromPromise(
    db
      .selectFrom("topics")
      .innerJoin("subscriptions as peer", (join) =>
        join
          .onRef("peer.topicId", "=", "topics.id")
          .on("peer.userId", "!=", userId)
      )
      .innerJoin("subscriptions as requester", (join) =>
        join
          .onRef("requester.topicId", "=", "topics.id")
          .on("requester.userId", "=", userId)
      )
      .innerJoin("users", "peer.userId", "users.id")
      .select([
        "topics.id as p2pTopicId",
        "users.id as topicId",
        "users.fullname as topicName",
        "requester.permissions as userPermissions",
        "peer.permissions as peerPermissions",
        "users.profilePhotoUrl",
        "topics.touchedAt",
        "users.lastOnline",
      ])
      .where("topics.id", "like", "p2p%")
      .execute(),
    (e) => e
  ).map((t) =>
    t.map((_t) => ({
      ..._t,
      p2pTopicId: _t.p2pTopicId as P2PTopicId,
      profilePhotoUrl: _t.profilePhotoUrl ? _t.profilePhotoUrl : null,
      lastOnline: _t.lastOnline ? new Date(_t.lastOnline) : null,
      touchedAt: _t.touchedAt ? new Date(_t.touchedAt) : null,
    }))
  );
  if (p2pTopicsResult.isErr()) {
    return err(p2pTopicsResult.error);
  }

  const p2pTopics: (ValuesType<typeof p2pTopicsResult.value> & {
    touchedAt: Date | null;
  })[] = [];

  for (const t of p2pTopicsResult.value) {
    const touchedAtResult = await fromPromise(
      db
        .selectFrom("messages")
        .select("createdAt")
        .where("topicId", "=", t.p2pTopicId)
        .orderBy("sequenceId", "desc")
        .limit(1)
        .executeTakeFirst(),
      (e) => e
    );
    if (touchedAtResult.isErr()) {
      return err(touchedAtResult.error);
    }

    const touchedAt =
      touchedAtResult.value === undefined
        ? null
        : touchedAtResult.value.createdAt;

    p2pTopics.push({ ...t, touchedAt });
  }

  return ok(p2pTopics);
}

export async function getPastGroupTopicsOfUser(db: KyselyDB, userId: UserId) {
  const topicEventLogs = await fromPromise(
    db
      .selectFrom("topicEventLogs")
      .innerJoin(
        "groupTopicMeta",
        "groupTopicMeta.topicId",
        "topicEventLogs.topicId"
      )
      .select((eb) => [
        sql<GroupTopicId>`DISTINCT ${eb.ref("topicEventLogs.topicId")}`.as(
          "topicId"
        ),
        "topicEventLogs.info",
        "groupTopicMeta.groupName as topicName",
        "groupTopicMeta.profilePhotoUrl",
      ])
      .where(({ eb, and, or }) =>
        or([
          and([
            eb("topicEventLogs.affectedUserId", "=", userId),
            eb("topicEventLogs.topicEvent", "=", "remove_member"),
          ]),
          and([
            eb("topicEventLogs.actorUserId", "=", userId),
            eb("topicEventLogs.topicEvent", "=", "leave_group"),
          ]),
        ])
      )
      .execute(),
    (e) => e
  );
  if (topicEventLogs.isErr()) {
    return err(topicEventLogs.error);
  }

  if (topicEventLogs.value.length == 0) {
    return ok([]);
  }

  const removedTopics = topicEventLogs.value;

  const presentSubscriptionResult = await fromPromise(
    db
      .selectFrom("subscriptions")
      .select("topicId")
      .where("userId", "=", userId)
      .where(
        "topicId",
        "in",
        removedTopics.map((t) => t.topicId)
      )
      .execute(),
    (e) => e
  );
  if (presentSubscriptionResult.isErr()) {
    return err(presentSubscriptionResult.error);
  }
  const presentTopicIds = presentSubscriptionResult.value.map((v) => v.topicId);

  const pastTopics = removedTopics
    .filter((v) => presentTopicIds.lastIndexOf(v.topicId) == -1)
    .map((t) => ({
      ...t,
      profilePhotoUrl: t.profilePhotoUrl
        ? completeMediaUrl(t.profilePhotoUrl)
        : null,
      touchedAt: null as null | Date,
      memberListSnapshot:
        t.info !== null &&
        (t.info.type === "leave_group" || t.info.type === "remove_member")
          ? t.info.memberListSnapshot ?? []
          : [],
    }));

  for (const t of pastTopics) {
    const touchedAtResult = await fromPromise(
      db
        .selectFrom("messages")
        .select("createdAt")
        .where("topicId", "=", t.topicId)
        .orderBy("sequenceId", "desc")
        .limit(1)
        .executeTakeFirst(),
      (e) => e
    );
    if (touchedAtResult.isErr()) {
      return err(touchedAtResult.error);
    }

    const touchedAt =
      touchedAtResult.value === undefined
        ? null
        : new Date(touchedAtResult.value.createdAt);

    t.touchedAt = touchedAt;
  }

  return ok(pastTopics);
}

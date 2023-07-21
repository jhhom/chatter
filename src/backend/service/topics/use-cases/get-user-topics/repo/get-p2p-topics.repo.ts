import { AppPgDatabase } from "~/backend/drizzle/db";
import {
  UserId,
  messages,
  subscriptions,
  users,
  topics,
  P2PTopicId,
} from "~/backend/drizzle/schema";
import { alias } from "drizzle-orm/pg-core";
import { like, eq, and, not, desc } from "drizzle-orm";
import { err, fromPromise } from "neverthrow";
import { ValuesType } from "utility-types";
import { ok } from "neverthrow";

export async function getP2PTopics(db: AppPgDatabase, userId: UserId) {
  const requester = alias(subscriptions, "requester");
  const peer = alias(subscriptions, "peer");

  const p2pTopicsResult = await fromPromise(
    db
      .select({
        p2pTopicId: topics.id,
        topicId: users.id,
        topicName: users.fullname,
        userPermissions: requester.permissions,
        peerPermissions: peer.permissions,
        profilePhotoUrl: users.profilePhotoUrl,
        touchedAt: topics.touchedAt,
        lastOnline: users.lastOnline,
      })
      .from(topics)
      .innerJoin(
        peer,
        and(eq(peer.topicId, topics.id), not(eq(peer.userId, userId)))
      )
      .innerJoin(
        requester,
        and(eq(requester.topicId, topics.id), eq(requester.userId, userId))
      )
      .innerJoin(users, eq(peer.userId, users.id))
      .where(like(topics.id, "p2p%")),
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
        .select({ createdAt: messages.createdAt })
        .from(messages)
        .where(eq(messages.topicId, t.p2pTopicId))
        .orderBy(desc(messages.sequenceId))
        .limit(1),
      (e) => e
    );
    if (touchedAtResult.isErr()) {
      return err(touchedAtResult.error);
    }
    const touchedAt =
      touchedAtResult.value.length === 0
        ? null
        : new Date(touchedAtResult.value[0].createdAt);
    p2pTopics.push({
      ...t,
      touchedAt,
    });
  }
  return ok(p2pTopics);
}

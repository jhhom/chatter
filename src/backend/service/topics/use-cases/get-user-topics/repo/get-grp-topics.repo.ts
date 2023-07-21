import { AppPgDatabase } from "~/backend/drizzle/db";
import { alias } from "drizzle-orm/pg-core";
import {
  subscriptions,
  messages,
  groupTopicMeta,
  topics,
  GroupTopicId,
  UserId,
} from "~/backend/drizzle/schema";
import { like, eq, and, not, desc } from "drizzle-orm";
import { err, fromPromise } from "neverthrow";
import { ValuesType } from "utility-types";
import { ok } from "neverthrow";
import { completeMediaUrl } from "~/backend/service/topics/use-cases/send-message/media";

export async function getGroupTopics(db: AppPgDatabase, userId: UserId) {
  const grpTopicsResult = await fromPromise(
    db
      .select({
        topicId: topics.id,
        topicName: groupTopicMeta.groupName,
        profilePhotoUrl: groupTopicMeta.profilePhotoUrl,
        touchedAt: topics.touchedAt,
        userPermissions: subscriptions.permissions,
        defaultPermissions: groupTopicMeta.defaultPermissions,
        ownerId: groupTopicMeta.ownerId,
      })
      .from(topics)
      .innerJoin(subscriptions, eq(subscriptions.topicId, topics.id))
      .innerJoin(groupTopicMeta, eq(groupTopicMeta.topicId, topics.id))
      .where(and(like(topics.id, "grp%"), eq(subscriptions.userId, userId))),
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
        .select({ createdAt: messages.createdAt })
        .from(messages)
        .where(eq(messages.topicId, t.topicId))
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
    grpTopics.push({
      ...t,
      touchedAt,
    });
  }
  return ok(grpTopics);
}

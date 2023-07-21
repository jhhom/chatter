import { AppPgDatabase } from "~/backend/drizzle/db";
import {
  groupTopicMeta,
  topicEventLogs,
  subscriptions,
  messages,
  UserId,
  GroupTopicId,
} from "~/backend/drizzle/schema";
import { fromPromise } from "neverthrow";
import { sql, or, eq, and, inArray, desc } from "drizzle-orm";
import { ok, err } from "neverthrow";
import { completeMediaUrl } from "~/backend/service/topics/use-cases/send-message/media";

export async function getPastGroupTopicsOfUser(
  db: AppPgDatabase,
  userId: UserId
) {
  const r = await fromPromise(
    db
      .select({
        topicId: sql<GroupTopicId>`DISTINCT topic_event_logs.topic_id`,
        topicName: groupTopicMeta.groupName,
        profilePhotoUrl: groupTopicMeta.profilePhotoUrl,
      })
      .from(topicEventLogs)
      .innerJoin(
        groupTopicMeta,
        eq(groupTopicMeta.topicId, topicEventLogs.topicId)
      )
      .where(
        or(
          and(
            eq(topicEventLogs.affectedUserId, userId),
            eq(topicEventLogs.topicEvent, "remove_member")
          ),
          and(
            eq(topicEventLogs.actorUserId, userId),
            eq(topicEventLogs.topicEvent, "leave_group")
          )
        )
      ),
    (e) => {
      return e;
    }
  );
  if (r.isErr()) {
    return err(r.error);
  }

  if (r.value.length == 0) {
    return ok([]);
  }

  const removedTopics = r.value;

  const presentSubscriptionsResult = await fromPromise(
    db
      .select({
        topicId: subscriptions.topicId,
      })
      .from(subscriptions)
      .where(
        and(
          inArray(
            subscriptions.topicId,
            r.value.map((t) => t.topicId)
          ),
          eq(subscriptions.userId, userId)
        )
      ),
    (e) => e
  );
  if (presentSubscriptionsResult.isErr()) {
    return err(presentSubscriptionsResult.error);
  }
  const presentTopicIds = presentSubscriptionsResult.value.map(
    (v) => v.topicId
  );

  const pastTopics = removedTopics
    .filter((v) => presentTopicIds.lastIndexOf(v.topicId) == -1)
    .map((t) => ({
      ...t,
      profilePhotoUrl: t.profilePhotoUrl
        ? completeMediaUrl(t.profilePhotoUrl)
        : null,
      touchedAt: null as null | Date,
    }));

  for (const t of pastTopics) {
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

    t.touchedAt = touchedAt;
  }

  return ok(pastTopics);
}

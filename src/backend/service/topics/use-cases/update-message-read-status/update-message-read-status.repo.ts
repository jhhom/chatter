import {
  topics,
  users,
  subscriptions,
  UserId,
  GroupTopicId,
  topicEventLogMetaRemoveMember,
  topicEventLogs,
  TopicId,
} from "~/backend/drizzle/schema";
import { ok, err, fromPromise, okAsync, errAsync } from "neverthrow";
import { eq, and, not, desc, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { AppPgDatabase } from "~/backend/drizzle/db";
import { IsGroupTopicId } from "~/backend/service/common/topics";

export async function db_updateMessageReadStatusForP2PTopic(
  ctx: {
    db: AppPgDatabase;
  },
  arg: {
    readSequenceId: number;
    updaterUserId: UserId;
    topicUserId: UserId;
  }
) {
  const topic = await getP2PTopicOf(ctx.db, {
    userId1: arg.updaterUserId,
    userId2: arg.topicUserId,
  });

  if (topic.isErr()) {
    return err(topic.error);
  }
  const topicId = topic.value.topicId;

  const updateResult = await updateReadSeqId(ctx.db, {
    topicId,
    subscriber: arg.updaterUserId,
    latestSeqId: arg.readSequenceId,
  });
  if (updateResult.isErr()) {
    if (
      updateResult.error.type == "no subscription found" ||
      updateResult.error.type == "sequence id to be updated is lagging"
    ) {
      return ok({ topicId, action: updateResult.error.type } as const);
    } else if (updateResult.error.type == "database") {
      return err(updateResult.error.cause);
    }
    return err(updateResult.error);
  }
  return ok({ topicId, action: "successfully updated" } as const);
}

/**
 * If the updater's subscription is missing, no action on database will be performed
 *
 * @returns The list of user ids who are subscribed to the affected group topic, except the updater
 */
export async function updateMessageReadStatusOfGroupTopicAndGetSubscribersToNotify(
  ctx: {
    db: AppPgDatabase;
  },
  arg: {
    readSequenceId: number;
    updaterUserId: UserId;
    topicId: GroupTopicId;
  }
) {
  const updateResult = await updateReadSeqId(ctx.db, {
    topicId: arg.topicId,
    subscriber: arg.updaterUserId,
    latestSeqId: arg.readSequenceId,
  });
  if (updateResult.isErr()) {
    if (updateResult.error.type == "database") {
      return err(updateResult.error.cause);
    }
  }
  const result = await getSubscribersOfGroupTopic(ctx.db, {
    topicId: arg.topicId,
    exceptUserId: arg.updaterUserId,
  });
  if (result.isErr()) {
    return err(result.error);
  }

  return ok(result.value);
}

function getSubscribersOfGroupTopic(
  db: AppPgDatabase,
  arg: {
    topicId: GroupTopicId;
    exceptUserId: UserId;
  }
) {
  return fromPromise(
    db
      .select({ userId: subscriptions.userId })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.topicId, arg.topicId),
          not(eq(subscriptions.userId, arg.exceptUserId))
        )
      ),
    (e) => e
  );
}

function getP2PTopicOf(
  db: AppPgDatabase,
  arg: {
    userId1: UserId;
    userId2: UserId;
  }
) {
  const subscriber1 = alias(subscriptions, "sub1");
  const subscriber2 = alias(subscriptions, "sub2");

  return fromPromise(
    db
      .select({ topicId: topics.id })
      .from(users)
      .where(
        and(
          eq(subscriber1.userId, arg.userId1),
          eq(subscriber2.userId, arg.userId2),
          eq(topics.topicType, "p2p")
        )
      )
      .innerJoin(subscriber1, eq(subscriber1.userId, arg.userId1))
      .innerJoin(subscriber2, eq(subscriber2.userId, arg.userId2))
      .innerJoin(
        topics,
        and(
          eq(topics.id, subscriber1.topicId),
          eq(topics.id, subscriber2.topicId)
        )
      ),
    (e) => e
  ).andThen((v) => {
    if (v.length == 0) {
      return errAsync("No topic found");
    }
    return okAsync(v[0]);
  });
}

async function updateReadSeqId(
  db: AppPgDatabase,
  arg: {
    topicId: TopicId;
    subscriber: UserId;
    latestSeqId: number;
  }
) {
  const matchingSubscriptionCondition = and(
    eq(subscriptions.userId, arg.subscriber),
    eq(subscriptions.topicId, arg.topicId)
  );

  const lastReadSeqIdResult = await fromPromise(
    db
      .select({ readSeqId: subscriptions.readSeqId })
      .from(subscriptions)
      .where(matchingSubscriptionCondition),
    (e) => e
  );
  if (lastReadSeqIdResult.isErr()) {
    return err({
      type: "database" as const,
      cause: lastReadSeqIdResult.error,
    } as const);
  }

  if (lastReadSeqIdResult.value.length == 0) {
    if (IsGroupTopicId(arg.topicId)) {
      const r = await updatePastSubscriptionReadSeqId(db, {
        topicId: arg.topicId,
        subscriber: arg.subscriber,
        latestSeqId: arg.latestSeqId,
      });
      if (r.isErr()) {
        return err(r.error);
      }
      return ok({});
    }

    return err({ type: "no subscription found" } as const);
  }

  const readSeqId = lastReadSeqIdResult.value[0].readSeqId ?? 0;
  if (readSeqId > arg.latestSeqId) {
    return err({ type: "sequence id to be updated is lagging" } as const);
  }

  const subscriptionUpdateResult = await fromPromise(
    db
      .update(subscriptions)
      .set({ readSeqId: arg.latestSeqId })
      .where(matchingSubscriptionCondition),
    (e) => e
  );
  if (subscriptionUpdateResult.isErr()) {
    return err({
      type: "database",
      cause: subscriptionUpdateResult.error,
    } as const);
  }
  return ok({});
}

async function updatePastSubscriptionReadSeqId(
  db: AppPgDatabase,
  arg: {
    topicId: GroupTopicId;
    subscriber: UserId;
    latestSeqId: number;
  }
) {
  const metaIdResult = await fromPromise(
    db
      .select({
        id: topicEventLogs.id,
        lastReadSeqId: topicEventLogMetaRemoveMember.readSeqId,
      })
      .from(topicEventLogMetaRemoveMember)
      .innerJoin(
        topicEventLogs,
        eq(topicEventLogs.id, topicEventLogMetaRemoveMember.id)
      )
      .where(
        and(
          eq(topicEventLogs.topicId, arg.topicId),
          or(
            and(
              eq(topicEventLogs.topicEvent, "remove_member"),
              eq(topicEventLogs.affectedUserId, arg.subscriber)
            ),
            and(
              eq(topicEventLogs.topicEvent, "leave_group"),
              eq(topicEventLogs.actorUserId, arg.subscriber)
            )
          )
        )
      )
      .orderBy(desc(topicEventLogs.createdAt))
      .limit(1),
    (e) => ({ type: "database" as const, cause: e })
  );
  if (metaIdResult.isErr()) {
    return err(metaIdResult.error);
  }
  if (metaIdResult.value.length == 0) {
    return err({ type: "no remove member log meta record found" as const });
  }
  const metaId = metaIdResult.value[0];

  const readSeqId = metaId.lastReadSeqId ?? 0;
  if (readSeqId > arg.latestSeqId) {
    return err({ type: "sequence id to be updated is lagging" } as const);
  }

  return fromPromise(
    db
      .update(topicEventLogMetaRemoveMember)
      .set({ readSeqId: arg.latestSeqId })
      .where(eq(topicEventLogMetaRemoveMember.id, metaId.id)),
    (e) => ({ type: "database" as const, cause: e })
  );
}

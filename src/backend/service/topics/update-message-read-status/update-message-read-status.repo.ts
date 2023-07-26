import { ok, err, fromPromise, okAsync, errAsync } from "neverthrow";
import { KyselyDB } from "~/backend/schema";
import { IsGroupTopicId } from "~/backend/service/common/topics";
import {
  UserId,
  GroupTopicId,
  TopicId,
} from "~/api-contract/subscription/subscription";

export async function updateMessageReadStatusForP2PTopic(
  db: KyselyDB,
  arg: {
    readSequenceId: number;
    updaterUserId: UserId;
    topicUserId: UserId;
  }
) {
  const topic = await getP2PTopicOf(db, {
    userId1: arg.updaterUserId,
    userId2: arg.topicUserId,
  });

  if (topic.isErr()) {
    return err(topic.error);
  }
  const topicId = topic.value.topicId;

  const updateResult = await updateReadSeqId(db, {
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
  db: KyselyDB,
  arg: {
    readSequenceId: number;
    updaterUserId: UserId;
    topicId: GroupTopicId;
  }
) {
  const updateResult = await updateReadSeqId(db, {
    topicId: arg.topicId,
    subscriber: arg.updaterUserId,
    latestSeqId: arg.readSequenceId,
  });
  if (updateResult.isErr()) {
    if (updateResult.error.type == "database") {
      return err(updateResult.error.cause);
    }
  }
  const result = await getSubscribersOfGroupTopic(db, {
    topicId: arg.topicId,
    exceptUserId: arg.updaterUserId,
  });
  if (result.isErr()) {
    return err(result.error);
  }

  return ok(result.value);
}

function getSubscribersOfGroupTopic(
  db: KyselyDB,
  arg: {
    topicId: GroupTopicId;
    exceptUserId: UserId;
  }
) {
  return fromPromise(
    db
      .selectFrom("subscriptions")
      .where("topicId", "=", arg.topicId)
      .where("userId", "!=", arg.exceptUserId)
      .select("userId")
      .execute(),
    (e) => e
  );
}

function getP2PTopicOf(
  db: KyselyDB,
  arg: {
    userId1: UserId;
    userId2: UserId;
  }
) {
  return fromPromise(
    db
      .selectFrom("topics")
      .select("topics.id as topicId")
      .innerJoin("subscriptions as sub1", (join) =>
        join.on("sub1.userId", "=", arg.userId1)
      )
      .innerJoin("subscriptions as sub2", (join) =>
        join.on("sub2.userId", "=", arg.userId2)
      )
      .whereRef("topics.id", "=", "sub1.topicId")
      .whereRef("topics.id", "=", "sub2.topicId")
      .where("topics.topicType", "=", "p2p")
      .executeTakeFirstOrThrow(),
    (e) => e
  );
}

async function updateReadSeqId(
  db: KyselyDB,
  arg: {
    topicId: TopicId;
    subscriber: UserId;
    latestSeqId: number;
  }
) {
  const lastReadSeqIdResult = await fromPromise(
    db
      .selectFrom("subscriptions")
      .select("readSeqId")
      .where("userId", "=", arg.subscriber)
      .where("topicId", "=", arg.topicId)
      .executeTakeFirst(),
    (e) => e
  );
  if (lastReadSeqIdResult.isErr()) {
    return err({
      type: "database" as const,
      cause: lastReadSeqIdResult.error,
    } as const);
  }

  if (lastReadSeqIdResult.value === undefined) {
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

  const readSeqId = lastReadSeqIdResult.value.readSeqId ?? 0;
  if (readSeqId > arg.latestSeqId) {
    return err({ type: "sequence id to be updated is lagging" } as const);
  }

  const subscriptionUpdateResult = await fromPromise(
    db
      .updateTable("subscriptions")
      .set({ readSeqId: arg.latestSeqId })
      .where("userId", "=", arg.subscriber)
      .where("topicId", "=", arg.topicId)
      .execute(),
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
  db: KyselyDB,
  arg: {
    topicId: GroupTopicId;
    subscriber: UserId;
    latestSeqId: number;
  }
) {
  const metaIdResult = await fromPromise(
    db
      .selectFrom("topicEventLogMetaRemoveMember")
      .innerJoin(
        "topicEventLogs",
        "topicEventLogs.id",
        "topicEventLogMetaRemoveMember.id"
      )
      .select([
        "topicEventLogMetaRemoveMember.id",
        "topicEventLogMetaRemoveMember.readSeqId as lastReadSeqId",
      ])
      .where("topicEventLogs.topicId", "=", arg.topicId)
      .where(({ and, or, eb }) =>
        or([
          and([
            eb("topicEventLogs.topicEvent", "=", "remove_member"),
            eb("topicEventLogs.affectedUserId", "=", arg.subscriber),
          ]),
          and([
            eb("topicEventLogs.topicEvent", "=", "leave_group"),
            eb("topicEventLogs.actorUserId", "=", arg.subscriber),
          ]),
        ])
      )
      .orderBy("topicEventLogs.createdAt", "desc")
      .limit(1)
      .executeTakeFirst(),
    (e) => ({ type: "database" as const, cause: e })
  );
  if (metaIdResult.isErr()) {
    return err(metaIdResult.error);
  }
  if (metaIdResult.value === undefined) {
    return err({ type: "no remove member log meta record found" as const });
  }

  const metaId = metaIdResult.value;

  const readSeqId = metaId.lastReadSeqId ?? 0;
  if (readSeqId > arg.latestSeqId) {
    return err({ type: "sequence id to be updated is lagging" } as const);
  }

  return fromPromise(
    db
      .updateTable("topicEventLogMetaRemoveMember")
      .set({ readSeqId: arg.latestSeqId })
      .where("topicEventLogMetaRemoveMember.id", "=", metaId.id)
      .execute(),
    (e) => ({ type: "database" as const, cause: e })
  );
}

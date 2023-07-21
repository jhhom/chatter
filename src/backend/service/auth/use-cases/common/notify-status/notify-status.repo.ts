import { AppPgDatabase } from "~/backend/drizzle/db";
import {
  topics,
  users,
  subscriptions,
  UserId,
  P2PTopicId,
  GroupTopicId,
} from "~/backend/drizzle/schema";
import { fromPromise, okAsync, err, ok } from "neverthrow";
import { eq, and, inArray, not } from "drizzle-orm";
import { IsGroupTopicId } from "~/backend/service/common/topics";
import * as R from "ramda";

export async function getUserTopics(db: AppPgDatabase, userId: UserId) {
  // 1. get all the topics of the users
  const topicIdsResult = await fromPromise(
    db
      .select({ topicId: subscriptions.topicId })
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId)),
    (e) => e
  );
  if (topicIdsResult.isErr()) {
    return err(topicIdsResult.error);
  }
  const topicIds = topicIdsResult.value;

  const [groupTopicIds, p2pTopicIds] = R.partition(
    (t) => IsGroupTopicId(t),
    topicIds.map((t) => t.topicId)
  ) as [GroupTopicId[], P2PTopicId[]];

  let p2pUserTopicIds: UserId[] = [];
  if (p2pTopicIds.length > 0) {
    const p2pUserIdsResult = await fromPromise(
      db
        .select({
          userId: users.id,
        })
        .from(topics)
        .innerJoin(subscriptions, eq(subscriptions.topicId, topics.id))
        .innerJoin(users, eq(subscriptions.userId, users.id))
        .where(
          and(
            inArray(topics.id, p2pTopicIds),
            not(eq(subscriptions.userId, userId))
          )
        ),
      (e) => e
    );
    if (p2pUserIdsResult.isErr()) {
      return err(p2pUserIdsResult.error);
    }
    p2pUserTopicIds = p2pUserIdsResult.value.map((i) => i.userId);
  }

  return ok({
    p2pTopics: p2pUserTopicIds,
    groupTopics: groupTopicIds,
  });
}

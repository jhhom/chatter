import { ok, err, fromPromise } from "neverthrow";
import { KyselyDB } from "~/backend/schema";
import {
  UserId,
  GroupTopicId,
  P2PTopicId,
} from "~/api-contract/subscription/subscription";
import { IsGroupTopicId } from "~/backend/service/common/topics";
import * as R from "ramda";

export async function getUserTopics(db: KyselyDB, userId: UserId) {
  // 1. get all topics of the users
  const topicIdsResult = await fromPromise(
    db
      .selectFrom("subscriptions")
      .select("subscriptions.topicId")
      .where("subscriptions.userId", "=", userId)
      .execute(),
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
        .selectFrom("topics")
        .innerJoin("subscriptions", (join) =>
          join.onRef("subscriptions.topicId", "=", "topics.id")
        )
        .innerJoin("users", (join) =>
          join.onRef("subscriptions.userId", "=", "users.id")
        )
        .select("users.id")
        .where("topics.id", "in", p2pTopicIds)
        .where(({ not, eb }) => not(eb("subscriptions.userId", "=", userId)))
        .execute(),
      (e) => e
    );
    if (p2pUserIdsResult.isErr()) {
      return err(p2pUserIdsResult.error);
    }
    p2pUserTopicIds = p2pUserIdsResult.value.map((i) => i.id);
  }
  return ok({
    p2pTopics: p2pUserTopicIds,
    groupTopics: groupTopicIds,
  });
}

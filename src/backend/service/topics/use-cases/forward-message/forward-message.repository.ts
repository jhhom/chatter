import { and, eq, isNotNull } from "drizzle-orm";
import { fromPromise, err, ok } from "neverthrow";

import {
  TopicId,
  messages,
  UserId,
  GroupTopicId,
} from "~/backend/drizzle/schema";
import { IsUserId } from "~/backend/service/common/topics";
import { getTopicIdOfP2PTopicBetween } from "~/backend/service/topics/common/repo";
import { AppPgDatabase } from "~/backend/drizzle/db";

export async function findMessage(
  db: AppPgDatabase,
  arg: {
    seqId: number;
    topicId: UserId | GroupTopicId;
    requesterUserId: UserId;
  }
) {
  let topicId: TopicId;
  if (IsUserId(arg.topicId)) {
    const r = await getTopicIdOfP2PTopicBetween(db, {
      topicUser1: arg.requesterUserId,
      topicUser2: arg.topicId,
    });
    if (r.isErr()) {
      return err(r.error);
    }
    topicId = r.value.topicId;
  } else {
    topicId = arg.topicId;
  }

  return fromPromise(
    db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.sequenceId, arg.seqId),
          eq(messages.topicId, topicId),
          isNotNull(messages.authorId)
        )
      ),
    (e) => e
  ).andThen((v) => {
    if (v.length == 0) {
      return err({ type: "message not found" as const });
    }
    return ok(v[0]);
  });
}

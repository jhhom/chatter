import { AppPgDatabase } from "~/backend/drizzle/db";
import {
  GroupTopicId,
  TopicId,
  UserId,
  messages,
} from "~/backend/drizzle/schema";
import { eq, and, lt } from "drizzle-orm";
import { err, fromPromise } from "neverthrow";
import { getTopicIdOfP2PTopicBetween } from "~/backend/service/topics/common/repo";
import { IsUserId } from "~/backend/service/common/topics";
import { ok } from "neverthrow";
import { ServiceResult } from "~/api-contract/types";
import { AppError } from "~/api-contract/errors/errors";

export default async function hasMessagesEarlierThan(
  db: AppPgDatabase,
  arg: {
    requesterUserId: UserId;
    topicId: UserId | GroupTopicId;
    beforeSequenceId: number;
  }
): ServiceResult<"topic/has_messages_earlier_than"> {
  if (IsUserId(arg.topicId)) {
    const topicIdResult = await getTopicIdOfP2PTopicBetween(db, {
      topicUser1: arg.requesterUserId,
      topicUser2: arg.topicId,
    });
    if (topicIdResult.isErr()) {
      if (topicIdResult.error.type == "topic not exist") {
        return ok(false);
      } else {
        return err(
          new AppError("UNKNOWN", { cause: topicIdResult.error.cause })
        );
      }
    }

    return doesTopicHasMessagesEarlierThan(
      db,
      topicIdResult.value.topicId,
      arg.beforeSequenceId
    );
  }

  return doesTopicHasMessagesEarlierThan(db, arg.topicId, arg.beforeSequenceId);
}

async function doesTopicHasMessagesEarlierThan(
  db: AppPgDatabase,
  topicId: TopicId,
  beforeSequenceId: number
) {
  return fromPromise(
    db
      .select({ id: messages.id })
      .from(messages)
      .where(
        and(
          eq(messages.topicId, topicId),
          lt(messages.sequenceId, beforeSequenceId)
        )
      )
      .limit(1),
    (e) => new AppError("DATABASE", { cause: e })
  ).map((v) => {
    return v.length > 0;
  });
}

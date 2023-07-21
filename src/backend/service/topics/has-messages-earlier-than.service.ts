import { KyselyDB } from "~/backend/schema";
import {
  GroupTopicId,
  TopicId,
  UserId,
} from "~/api-contract/subscription/subscription";
import { err, ok, fromPromise } from "neverthrow";
import { IsUserId } from "~/backend/service/common/topics";
import { ServiceResult } from "~/api-contract/types";
import { AppError } from "~/api-contract/errors/errors";
import { getTopicIdOfP2PTopicBetween } from "~/backend/service/topics/common/repo/repo";

export default async function hasMessagesEarlierThan(
  db: KyselyDB,
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

    return doesTopicHasMessagesEarlierThan(db, {
      topicId: topicIdResult.value.topicId,
      beforeSequenceId: arg.beforeSequenceId,
    });
  }
  return doesTopicHasMessagesEarlierThan(db, {
    topicId: arg.topicId,
    beforeSequenceId: arg.beforeSequenceId,
  });
}

function doesTopicHasMessagesEarlierThan(
  db: KyselyDB,
  arg: {
    topicId: TopicId;
    beforeSequenceId: number;
  }
) {
  return fromPromise(
    db
      .selectFrom("messages")
      .select("id")
      .where("topicId", "=", arg.topicId)
      .where("sequenceId", "<", arg.beforeSequenceId)
      .limit(1)
      .executeTakeFirst(),
    (e) => new AppError("DATABASE", { cause: e })
  ).map((v) => v !== undefined);
}

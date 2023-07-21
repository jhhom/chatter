import { err, ok, fromPromise } from "neverthrow";
import { KyselyDB } from "~/backend/schema";
import { IsUserId } from "~/backend/service/common/topics";
import {
  GroupTopicId,
  UserId,
  TopicId,
} from "~/api-contract/subscription/subscription";
import { getTopicIdOfP2PTopicBetween } from "~/backend/service/topics/common/repo/repo";

export async function getMessage(
  db: KyselyDB,
  arg: {
    topicId: UserId | GroupTopicId;
    requesterUserId: UserId;
    messageSeqId: number;
  }
) {
  let topicId: TopicId;
  if (IsUserId(arg.topicId)) {
    const topicIdResult = await getTopicIdOfP2PTopicBetween(db, {
      topicUser1: arg.requesterUserId,
      topicUser2: arg.topicId,
    });
    if (topicIdResult.isErr()) {
      return err(topicIdResult.error);
    }
    topicId = topicIdResult.value.topicId;
  } else {
    topicId = arg.topicId;
  }

  return fromPromise(
    db
      .selectFrom("messages")
      .select(["id", "content", "authorId"])
      .where("topicId", "=", topicId)
      .where("sequenceId", "=", arg.messageSeqId)
      .executeTakeFirst(),
    (e) => e
  );
}

import { KyselyDB } from "~/backend/schema";
import { UserId, GroupTopicId, TopicId } from "~/backend/schema";
import { IsUserId } from "~/backend/service/common/topics";
import { getTopicIdOfP2PTopicBetween } from "~/backend/service/topics/common/repo/repo";
import { fromPromise, ok, err } from "neverthrow";
import { AppError } from "~/api-contract/errors/errors";

export async function findMessage(
  db: KyselyDB,
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
      .selectFrom("messages")
      .selectAll()
      .where("messages.sequenceId", "=", arg.seqId)
      .where("messages.topicId", "=", topicId)
      .where("messages.authorId", "is not", null)
      .executeTakeFirstOrThrow(),
    (e) => new AppError("DATABASE", { cause: e })
  );
}

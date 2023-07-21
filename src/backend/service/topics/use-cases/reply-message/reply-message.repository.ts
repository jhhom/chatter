import { err, ok, fromPromise } from "neverthrow";
import { and, eq } from "drizzle-orm";

import { AppPgDatabase } from "~/backend/drizzle/db";
import {
  GroupTopicId,
  TopicId,
  UserId,
  messages,
} from "~/backend/drizzle/schema";
import { IsUserId } from "~/backend/service/common/topics";
import { getTopicIdOfP2PTopicBetween } from "~/backend/service/topics/common/repo";

export async function getMessage(
  db: AppPgDatabase,
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
    db.query.messages.findFirst({
      columns: { id: true, content: true, authorId: true },
      where: and(
        eq(messages.topicId, topicId),
        eq(messages.sequenceId, arg.messageSeqId)
      ),
    }),
    (e) => e
  );
}

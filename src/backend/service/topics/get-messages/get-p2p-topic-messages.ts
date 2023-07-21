import { KyselyDB } from "~/backend/schema";
import { Message, UserId } from "~/api-contract/subscription/subscription";
import { getTopicIdOfP2PTopicBetween } from "~/backend/service/topics/common/repo/repo";
import { formatTopicEventLogMessage } from "~/backend/service/common/topics";
import {
  getPrecedingMessageDate,
  getIsFirstOfDateForMessages,
} from "~/backend/service/topics/common/repo/repo";
import { ok, err, fromPromise } from "neverthrow";
import {
  getMessagesQuery,
  formatQueriedMessage,
} from "~/backend/service/topics/common/repo/get-messages";
import { SqlBool, Expression } from "kysely";

export async function getP2PTopicMessages(
  db: KyselyDB,
  arg: {
    requesterUserId: UserId;
    topicId: UserId;
    beforeSequenceId: number;
    numberOfMessages: number;
  }
) {
  // The flow of retrieving messages of a P2P topic for the user
  // -------------------------------------------------------------
  // 1. Get the topic id of the P2P topic requested
  // 2. Retrieve all the messages (including event logs)
  // 3. Determine the `isFirstOfDate` for every message
  // 4. Return the messages array as the result

  // 1. ⭐️ GET THE TOPIC ID OF THE P2P TOPIC REQUESTED
  const topicIdResult = await getTopicIdOfP2PTopicBetween(db, {
    topicUser1: arg.requesterUserId,
    topicUser2: arg.topicId,
  });
  if (topicIdResult.isErr()) {
    if (topicIdResult.error.type == "topic not exist") {
      return ok({ messages: [], topicId: null });
    } else {
      return err(topicIdResult.error);
    }
  }
  const topicId = topicIdResult.value.topicId;

  // 2. ⭐️ RETRIEVE ALL THE MESSAGES (INCLUDING EVENT LOGS)
  const msgs = await fromPromise(
    getMessagesQuery(db, { requesterUserId: arg.requesterUserId })
      .where((eb) => {
        const filters: Expression<SqlBool>[] = [
          eb("messages.topicId", "=", topicIdResult.value.topicId),
        ];
        if (arg.beforeSequenceId > -1) {
          filters.push(eb("messages.sequenceId", "<", arg.beforeSequenceId));
        }

        return eb.and(filters);
      })
      .execute(),
    (e) => e
  )
    .map((v) => {
      return (
        v
          // filter out messages that is deleted for self
          .filter((m) => {
            return (
              m.messageDeleteLogs.findIndex((x) => x.deletedFor == "self") == -1
            );
          })
          .map(formatQueriedMessage({ requesterUserId: arg.requesterUserId }))
      );
    })
    .map((v) => v.sort((a, b) => a.sequenceId - b.sequenceId));

  if (msgs.isErr()) {
    return err(msgs.error);
  }

  // 3. ⭐️ DETERMINE THE `IS FIRST OF DATE` FOR EVERY MESSAGE
  let precedingMessageDate: Date | undefined;
  if (msgs.value.length != 0) {
    const r = await getPrecedingMessageDate(db, {
      topicId,
      beforeSequenceId: msgs.value[0].sequenceId,
    });
    if (r.isErr()) {
      return err(r.error);
    }
    precedingMessageDate = r.value;
  }

  const messagesWithFirstOfDate = getIsFirstOfDateForMessages(
    msgs.value,
    precedingMessageDate
  );

  return ok({
    messages: messagesWithFirstOfDate,
    topicId,
  });
}

import { fromPromise, ok, err, errAsync } from "neverthrow";

import { DB, KyselyDB, TopicEvent } from "~/backend/schema";
import { GroupTopicId, UserId } from "~/api-contract/subscription/subscription";
import { getPrecedingMessageDate } from "~/backend/service/topics/common/repo/repo";
import { getSubscriptionPeriods } from "~/backend/service/topics/common/repo/get-subscription-period";
// import { jsonBuildObject } from "kysely/helpers/postgres";
import { jsonObjectFrom, jsonArrayFrom } from "kysely/helpers/postgres";
import { Expression, SqlBool, expressionBuilder as eb } from "kysely";
import { getIsFirstOfDateForMessages } from "~/backend/service/topics/common/repo/repo";
import {
  formatQueriedMessage,
  getMessagesQuery,
} from "~/backend/service/topics/common/repo/get-messages";

export async function getGroupTopicMessages(
  db: KyselyDB,
  arg: {
    requesterUserId: UserId;
    topicId: GroupTopicId;
    beforeSequenceId: number;
    untilSequenceId: number;
  }
) {
  // The flow of retrieving messages of a group topic for the user
  // -------------------------------------------------------------
  // 1. Get the subscription period of the user for the group topic
  //    - Only the messages between the subscription period should be retrieved
  // 2. Retrieve all the messages (including event logs)
  // 3. Determine the `isFirstOfDate` for every message
  // 4. Return the messages array as the result

  // 1. ⭐️ GET THE SUBSCRIPTION PERIOD
  const subscriptionPeriodResult = await getSubscriptionPeriods(db, arg);
  if (subscriptionPeriodResult.isErr()) {
    return err(subscriptionPeriodResult.error);
  }
  const subscriptionPeriods = subscriptionPeriodResult.value.periods;
  const subscriptionStartSeqId =
    subscriptionPeriodResult.value.subscriptionStartSeqId;

  // 2. ⭐️ RETRIEVE ALL MESSAGES (INCLUDING EVENT LOGS)
  const msgs = await fromPromise(
    getMessagesQuery(db, { requesterUserId: arg.requesterUserId })
      .where((eb) => {
        const filters: Expression<SqlBool>[] = [
          eb("messages.topicId", "=", arg.topicId),
          eb("messages.sequenceId", ">=", arg.untilSequenceId),
        ];
        if (arg.beforeSequenceId > -1) {
          filters.push(eb("messages.sequenceId", "<", arg.beforeSequenceId));
        }
        filters.push(
          eb.or(
            subscriptionPeriods.map((p) =>
              p.length == 2
                ? eb.and([
                    eb("messages.sequenceId", ">=", p[0]),
                    eb("messages.sequenceId", "<=", p[1]),
                  ])
                : eb("messages.sequenceId", ">=", p[0])
            )
          )
        );

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
      topicId: arg.topicId,
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
    topicId: arg.topicId,
    subscriptionStartSeqId,
  });
}

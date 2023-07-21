import { KyselyDB } from "~/backend/schema";
import { UserId, GroupTopicId } from "~/api-contract/subscription/subscription";
import { fromPromise, ok, err } from "neverthrow";

export async function getSubscriptionPeriods(
  db: KyselyDB,
  arg: {
    requesterUserId: UserId;
    topicId: GroupTopicId;
  }
) {
  // 1. get all topic event logs (seqId) that correspond to add member
  // 2. get all topic event logs (seqId) that correspond to remove member / exit group / member got removed
  // 3. sort them
  //
  // e.g add member get: 3, 12, 18
  //     member exited get: 5, 14
  // sorted would be [2, 5], [12, 14], [18]
  //
  // e.g add member get: 1
  // sorted would be [1]
  //
  // e.g add member get 3, 12, 18
  //     member exited get 5, 14, 21
  // sorted would be [3, 5], [12, 14], [18, 21]
  //
  // to check whether user still has a subscription
  // just get the last number in the sorted list, if the num is a pair, user no longer has any subscription
  // if user don't have any numbers at all, user never have subscription

  const addMemberLogSeqIds = await fromPromise(
    db
      .selectFrom("topicEventLogs")
      .innerJoin("messages", "messages.id", "topicEventLogs.messageId")
      .select("messages.sequenceId")
      .where(({ or, and, eb }) =>
        and([
          eb("topicEventLogs.topicId", "=", arg.topicId),
          or([
            and([
              eb("topicEventLogs.affectedUserId", "=", arg.requesterUserId),
              eb("topicEventLogs.topicEvent", "=", "add_member"),
            ]),
            and([
              eb("topicEventLogs.actorUserId", "=", arg.requesterUserId),
              or([
                eb("topicEventLogs.topicEvent", "=", "create_group"),
                eb(
                  "topicEventLogs.topicEvent",
                  "=",
                  "join-group-through-invite-link"
                ),
                eb("topicEventLogs.topicEvent", "=", "join-group-through-id"),
              ]),
            ]),
          ]),
        ])
      )
      .orderBy("messages.sequenceId", "desc")
      .execute(),
    (e) => e
  );
  if (addMemberLogSeqIds.isErr()) {
    return err(addMemberLogSeqIds.error);
  }
  if (addMemberLogSeqIds.value.length == 0) {
    return err({
      type: "no add member log, user is never subscribed to the group" as const,
    });
  }

  const removeMemberSeqIdResult = await fromPromise(
    db
      .selectFrom("topicEventLogs")
      .innerJoin("messages", "messages.id", "topicEventLogs.messageId")
      .select("messages.sequenceId")
      .where(({ or, and, eb }) =>
        and([
          eb("topicEventLogs.topicId", "=", arg.topicId),
          or([
            and([
              eb("topicEventLogs.affectedUserId", "=", arg.requesterUserId),
              eb("topicEventLogs.topicEvent", "=", "remove_member"),
            ]),
            and([
              eb("topicEventLogs.actorUserId", "=", arg.requesterUserId),
              eb("topicEventLogs.topicEvent", "=", "leave_group"),
            ]),
          ]),
        ])
      )
      .orderBy("messages.sequenceId", "desc")
      .execute(),
    (e) => e
  );
  if (removeMemberSeqIdResult.isErr()) {
    return err(removeMemberSeqIdResult.error);
  }

  const periods = pairArrays(
    addMemberLogSeqIds.value.map((a) => a.sequenceId),
    removeMemberSeqIdResult.value.map((a) => a.sequenceId)
  );

  return ok({
    subscriptionStartSeqId: periods[0][0],
    periods,
  });
}

function pairArrays(startingInts: number[], endingInts: number[]): number[][] {
  const pairs: number[][] = [];
  // 1. Make sure start and end arrays are sorted in ASC order
  startingInts = startingInts.sort((a, b) => a - b);
  endingInts = endingInts.sort((a, b) => a - b);

  let endIdx = 0;
  let startIdx = 0;

  while (startIdx < startingInts.length && endIdx < endingInts.length) {
    const start = startingInts[startIdx];
    const end = endingInts[endIdx];

    if (end > start) {
      pairs.push([start, end]);
      endIdx++;
      startIdx++;
    } else if (endIdx + 1 == endingInts.length) {
      pairs.push([start]);
      startIdx++;
    } else {
      endIdx++;
    }
  }

  if (startingInts.length >= startIdx + 1) {
    pairs.push([startingInts[startIdx]]);
  }

  if (endingInts.length == 0 && startingInts.length != 0) {
    return [[startingInts[0]]];
  }

  return pairs;
}

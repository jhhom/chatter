import { exists, and, eq, desc, SQL, lt, lte, gte, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { fromPromise, ok, err } from "neverthrow";

import { AppPgDatabase } from "~/backend/drizzle/db";
import {
  GroupTopicId,
  UserId,
  messages,
  topicEventLogs,
  messageDeleteLogs,
  users,
  messageReplyLogs,
} from "~/backend/drizzle/schema";
import { jsonAggBuildObject } from "~/backend/drizzle/db";
import {
  getPrecedingMessageDate,
  getIsFirstOfDateForMessages,
} from "~/backend/service/topics/common/repo";
import { formatTopicEventLogMessage } from "~/backend/service/common/topics";
import type { Message } from "~/backend/drizzle/message-type";

export async function getGroupTopicMessages(
  db: AppPgDatabase,
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
  let messagesFilter: SQL<unknown>[] = [
    eq(messages.topicId, arg.topicId),
    gte(messages.sequenceId, arg.untilSequenceId),
  ];
  if (arg.beforeSequenceId > -1) {
    messagesFilter.push(lt(messages.sequenceId, arg.beforeSequenceId));
  }

  const periodFilters = or(
    ...subscriptionPeriods.map((p) =>
      p.length == 2
        ? and(gte(messages.sequenceId, p[0]), lte(messages.sequenceId, p[1]))
        : gte(messages.sequenceId, p[0])
    )
  );
  if (periodFilters) {
    messagesFilter.push(periodFilters);
  }

  const affected = alias(users, "affected");
  const actor = alias(users, "actor");
  const replyToMessage = alias(messages, "reply_to_message");

  const msgs = await fromPromise(
    db
      .select({
        content: messages.content,
        sequenceId: messages.sequenceId,
        author: messages.authorId,
        createdAt: messages.createdAt,
        topicEventLogs: topicEventLogs,
        eventActor: {
          userId: actor.id,
          name: actor.fullname,
        },
        eventAffected: {
          userId: affected.id,
          name: affected.fullname,
        },
        messageDeleteLogs: jsonAggBuildObject(
          {
            deletedFor: messageDeleteLogs.deletedFor,
          },
          "message_delete_logs"
        ),
        messageReplyTo: {
          sequenceId: replyToMessage.sequenceId,
          content: replyToMessage.content,
          authorId: replyToMessage.authorId,
        },
      })
      .from(messages)
      .leftJoin(messageReplyLogs, eq(messages.id, messageReplyLogs.messageId))
      .leftJoin(
        replyToMessage,
        eq(messageReplyLogs.replyToMessage, replyToMessage.id)
      )
      .leftJoin(topicEventLogs, eq(messages.id, topicEventLogs.messageId))
      .leftJoin(affected, eq(topicEventLogs.affectedUserId, affected.id))
      .leftJoin(actor, eq(topicEventLogs.actorUserId, actor.id))
      .leftJoin(
        messageDeleteLogs,
        and(
          eq(messageDeleteLogs.messageId, messages.id),
          or(
            eq(messageDeleteLogs.deletedFor, "everyone"),
            and(
              eq(messageDeleteLogs.deletedFor, "self"),
              eq(messageDeleteLogs.deletedBy, arg.requesterUserId)
            )
          )
        )
      )
      .groupBy(
        messages.id,
        topicEventLogs.id,
        actor.id,
        affected.id,
        replyToMessage.id
      )
      .where(and(...messagesFilter))
      // order by desc because we get the latest messages first
      .orderBy(desc(messages.sequenceId)),
    (e) => e
    // sort the messages from earliest to latest
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
          .map((m) => {
            if (m.author == null) {
              if (m.topicEventLogs != undefined) {
                const actorName =
                  arg.requesterUserId ==
                  (m.eventActor == null ? `` : m.eventActor.userId)
                    ? "You"
                    : m.eventActor
                    ? m.eventActor.name
                    : "";
                const affectedName =
                  arg.requesterUserId ==
                  (m.eventAffected == null ? `` : m.eventAffected.userId)
                    ? "You"
                    : m.eventAffected
                    ? m.eventAffected.name
                    : "";

                const content: Message = {
                  type: "text",
                  content: formatTopicEventLogMessage(
                    m.topicEventLogs.topicEvent,
                    {
                      actor: actorName,
                      affected: affectedName,
                    }
                  ),
                  forwarded: false,
                };

                return {
                  type: "event_log" as const,
                  // the content here doesn't matter, we simply want to fit to the structure
                  // of argument of `getIsFirstDateForMessages2`
                  event: m.topicEventLogs.topicEvent,
                  content,
                  createdAt: new Date(m.createdAt),
                  sequenceId: m.sequenceId,
                };
              } else {
                const content: Message = {
                  type: "text",
                  content: "Event is undefined",
                  forwarded: false,
                };
                return {
                  type: "event_log" as const,
                  event: "create_group" as const,
                  content,
                  createdAt: new Date(m.createdAt),
                  sequenceId: m.sequenceId,
                };
              }
            } else {
              let deleted =
                m.messageDeleteLogs.findIndex(
                  (x) => x.deletedFor == "everyone"
                ) != -1;

              if (deleted) {
                return {
                  type: "message" as const,
                  sequenceId: m.sequenceId,
                  content: {
                    type: "text" as const,
                    content: "",
                    forwarded: false,
                    replyTo: null,
                  },
                  author: m.author,
                  createdAt: new Date(m.createdAt),
                  deleted,
                };
              }

              return {
                type: "message" as const,
                sequenceId: m.sequenceId,
                content: {
                  ...m.content!,
                  replyTo:
                    m.messageReplyTo === null
                      ? null
                      : {
                          ...m.messageReplyTo.content!,
                          authorId: m.messageReplyTo.authorId!,
                          seqId: m.messageReplyTo.sequenceId,
                        },
                },
                author: m.author,
                createdAt: new Date(m.createdAt),
                deleted,
              };
            }
          })
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

export async function getSubscriptionPeriods(
  db: AppPgDatabase,
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
  const addMemberSeqIdResult = await fromPromise(
    db
      .select({
        sequenceId: messages.sequenceId,
      })
      .from(topicEventLogs)
      .innerJoin(messages, eq(messages.id, topicEventLogs.messageId))
      .where(
        and(
          eq(topicEventLogs.topicId, arg.topicId),
          or(
            and(
              eq(topicEventLogs.affectedUserId, arg.requesterUserId),
              eq(topicEventLogs.topicEvent, "add_member")
            ),
            and(
              eq(topicEventLogs.actorUserId, arg.requesterUserId),
              or(
                eq(topicEventLogs.topicEvent, "create_group"),
                eq(topicEventLogs.topicEvent, "join-group-through-invite-link"),
                eq(topicEventLogs.topicEvent, "join-group-through-id")
              )
            )
          )
        )
      )
      .orderBy(desc(messages.sequenceId)),
    (e) => {
      return e;
    }
  ).andThen((v) => {
    if (v.length == 0) {
      return err({
        type: "no add member log, user is never subscribed to the group" as const,
      });
    }
    return ok(v);
  });
  if (addMemberSeqIdResult.isErr()) {
    return err(addMemberSeqIdResult.error);
  }
  const addMemberSeqIds = addMemberSeqIdResult.value;

  const removeMemberSeqIdResult = await fromPromise(
    db
      .select({
        sequenceId: messages.sequenceId,
      })
      .from(topicEventLogs)
      .innerJoin(messages, eq(messages.id, topicEventLogs.messageId))
      .where(
        and(
          eq(topicEventLogs.topicId, arg.topicId),
          or(
            and(
              eq(topicEventLogs.affectedUserId, arg.requesterUserId),
              eq(topicEventLogs.topicEvent, "remove_member")
            ),
            and(
              eq(topicEventLogs.actorUserId, arg.requesterUserId),
              eq(topicEventLogs.topicEvent, "leave_group")
            )
          )
        )
      )
      .orderBy(desc(messages.sequenceId)),
    (e) => e
  );
  if (removeMemberSeqIdResult.isErr()) {
    return err(removeMemberSeqIdResult.error);
  }
  const removeMemberSeqIds = removeMemberSeqIdResult.value;
  const periods = pairArrays(
    addMemberSeqIds.map((a) => a.sequenceId),
    removeMemberSeqIds.map((a) => a.sequenceId)
  );

  return ok({
    subscriptionStartSeqId: periods[0][0],
    periods,
  });
}

export function pairArrays(
  startingInts: number[],
  endingInts: number[]
): number[][] {
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

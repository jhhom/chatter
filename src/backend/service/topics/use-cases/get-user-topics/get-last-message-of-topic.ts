import { alias } from "drizzle-orm/pg-core";
import { and, eq, isNull, desc } from "drizzle-orm";
import { fromPromise, ok, err, Result } from "neverthrow";
import { match } from "ts-pattern";

import { AppPgDatabase } from "~/backend/drizzle/db";
import {
  TopicId,
  UserId,
  messageDeleteLogs,
  messages,
  users,
  topicEventLogs,
} from "~/backend/drizzle/schema";
import { formatTopicEventLogMessage } from "~/backend/service/common/topics";

export type LastMessageOfTopic = {
  sequenceId: number;
} & (
  | {
      type: "message";
      content: string;
    }
  | {
      type: "deleted";
    }
);

export async function getLastMessageOfTopic(
  db: AppPgDatabase,
  arg: {
    topicId: TopicId;
    requesterUserId: UserId;
  }
): Promise<Result<LastMessageOfTopic | null, unknown>> {
  // need to get the message with biggest sequence id where there is no entry in the message_delete_logs with deleted_self and deleted_by = requester_user_id
  const deletedForEveryoneLog = alias(
    messageDeleteLogs,
    "deleted_for_everyone_log"
  );
  const deletedForSelfLog = alias(messageDeleteLogs, "deleted_for_self_log");
  const eventActor = alias(users, "event_actor");
  const eventAffected = alias(users, "event_affected");

  const messageResult = await fromPromise(
    db
      .select({
        message: {
          sequenceId: messages.sequenceId,
          content: messages.content,
          createdAt: messages.createdAt,
          authorId: messages.authorId,
          authorName: users.fullname,
        },
        deletedForEveryoneLog: deletedForEveryoneLog.id,
        topicEventLog: {
          topicEvent: topicEventLogs.topicEvent,
          actorUserId: topicEventLogs.actorUserId,
          affectedUserId: topicEventLogs.affectedUserId,
          actorName: eventActor.fullname,
          affectedName: eventAffected.fullname,
        },
      })
      .from(messages)
      .leftJoin(users, eq(messages.authorId, users.id))
      .leftJoin(
        deletedForSelfLog,
        and(
          eq(deletedForSelfLog.messageId, messages.id),
          eq(deletedForSelfLog.deletedFor, "self"),
          eq(deletedForSelfLog.deletedBy, arg.requesterUserId)
        )
      )
      .leftJoin(
        deletedForEveryoneLog,
        and(
          eq(deletedForEveryoneLog.messageId, messages.id),
          eq(deletedForEveryoneLog.deletedFor, "everyone")
        )
      )
      .leftJoin(topicEventLogs, eq(messages.id, topicEventLogs.messageId))
      .leftJoin(eventActor, eq(topicEventLogs.actorUserId, eventActor.id))
      .leftJoin(
        eventAffected,
        eq(topicEventLogs.affectedUserId, eventAffected.id)
      )
      .where(
        and(eq(messages.topicId, arg.topicId), isNull(deletedForSelfLog.id))
      )
      .orderBy(desc(messages.sequenceId))
      .limit(1),
    (e) => e
  );

  if (messageResult.isErr()) {
    return err(messageResult.error);
  }

  if (messageResult.value.length == 0) {
    return ok(null);
  }

  const message = messageResult.value[0];

  let result: LastMessageOfTopic = {
    type: "message",
    content: "",
    sequenceId: message.message.sequenceId,
  };

  if (message.deletedForEveryoneLog !== null) {
    result = {
      type: "deleted",
      sequenceId: message.message.sequenceId,
    };
  } else if (message.topicEventLog === null) {
    const author =
      message.message.authorId === arg.requesterUserId
        ? "You"
        : message.message.authorName;

    result = {
      type: "message",
      content: message.message.content
        ? match(message.message.content)
            .with({ type: "text" }, (c) => c.content)
            .with({ type: "file" }, (c) => `${author} sent a file`)
            .with({ type: "picture" }, (c) => `${author} sent a picture`)
            .exhaustive()
        : "",
      sequenceId: message.message.sequenceId,
    };
  } else if (message.topicEventLog.topicEvent !== null) {
    const actorName =
      message.topicEventLog.actorUserId === arg.requesterUserId
        ? "You"
        : message.topicEventLog.actorName ?? "";
    const affectedName =
      message.topicEventLog.affectedUserId === arg.requesterUserId
        ? "You"
        : message.topicEventLog.affectedName ?? "";

    result = {
      type: "message",
      content: formatTopicEventLogMessage(message.topicEventLog.topicEvent, {
        actor: actorName,
        affected: affectedName,
      }),
      sequenceId: message.message.sequenceId,
    };
  } else {
    const author =
      message.message.authorId === arg.requesterUserId
        ? "You"
        : message.message.authorName;

    result = {
      type: "message",
      content: message.message.content
        ? match(message.message.content)
            .with({ type: "text" }, (c) => c.content)
            .with({ type: "file" }, (c) => `${author} sent a file`)
            .with({ type: "picture" }, (c) => `${author} sent a picture`)
            .exhaustive()
        : "",
      sequenceId: message.message.sequenceId,
    };
  }

  return ok(result);
}

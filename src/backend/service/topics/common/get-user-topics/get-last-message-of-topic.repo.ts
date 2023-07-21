import { jsonObjectFrom } from "kysely/helpers/postgres";
import { fromPromise, ok, err, Result } from "neverthrow";
import { match } from "ts-pattern";
import { TopicId, UserId } from "~/api-contract/subscription/subscription";

import { KyselyDB } from "~/backend/schema";
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
  db: KyselyDB,
  arg: {
    topicId: TopicId;
    requesterUserId: UserId;
  }
): Promise<Result<LastMessageOfTopic | null, unknown>> {
  const messageResult = await fromPromise(
    db
      .selectFrom("messages")
      .leftJoin("users as author", "messages.authorId", "author.id")
      .leftJoin("messageDeleteLogs as deletedForSelfLog", (join) =>
        join
          .onRef("deletedForSelfLog.messageId", "=", "messages.id")
          .on("deletedForSelfLog.deletedFor", "=", "self")
          .on("deletedForSelfLog.deletedBy", "=", arg.requesterUserId)
      )
      .leftJoin("messageDeleteLogs as deletedForEveryoneLog", (join) =>
        join
          .onRef("deletedForEveryoneLog.messageId", "=", "messages.id")
          .on("deletedForEveryoneLog.deletedFor", "=", "everyone")
      )
      .select((eb) => [
        "messages.sequenceId",
        "messages.content",
        "messages.createdAt",
        "messages.authorId",
        "author.fullname as authorName",
        "deletedForEveryoneLog.id as deletedForEveryoneLog",
        jsonObjectFrom(
          eb
            .selectFrom("topicEventLogs")
            .innerJoin(
              "users as eventActor",
              "eventActor.id",
              "topicEventLogs.actorUserId"
            )
            .leftJoin(
              "users as eventAffected",
              "eventAffected.id",
              "topicEventLogs.affectedUserId"
            )
            .select([
              "topicEventLogs.topicEvent",
              "topicEventLogs.actorUserId",
              "topicEventLogs.affectedUserId",
              "eventActor.fullname as actorName",
              "eventAffected.fullname as affectedName",
            ])
            .whereRef("messages.id", "=", "topicEventLogs.messageId")
        ).as("topicEventLog"),
      ])
      .where("messages.topicId", "=", arg.topicId)
      .where("deletedForSelfLog.id", "is", null)
      .orderBy("messages.sequenceId", "desc")
      .limit(1)
      .executeTakeFirst(),
    (e) => e
  );

  if (messageResult.isErr()) {
    return err(messageResult.error);
  }

  if (messageResult.value === undefined) {
    return ok(null);
  }

  const message = messageResult.value;

  let result: LastMessageOfTopic = {
    type: "message",
    content: "",
    sequenceId: message.sequenceId,
  };

  if (message.deletedForEveryoneLog !== null) {
    result = {
      type: "deleted",
      sequenceId: message.sequenceId,
    };
  } else if (message.topicEventLog === null) {
    const author =
      message.authorId === arg.requesterUserId ? "You" : message.authorName;

    result = {
      type: "message",
      content: message.content
        ? match(message.content)
            .with({ type: "text" }, (c) => c.content)
            .with({ type: "file" }, (c) => `${author} sent a file`)
            .with({ type: "picture" }, (c) => `${author} sent a picture`)
            .exhaustive()
        : "",
      sequenceId: message.sequenceId,
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
      sequenceId: message.sequenceId,
    };
  } else {
    const author =
      message.authorId === arg.requesterUserId ? "You" : message.authorName;

    result = {
      type: "message",
      content: message.content
        ? match(message.content)
            .with({ type: "text" }, (c) => c.content)
            .with({ type: "file" }, (c) => `${author} sent a file`)
            .with({ type: "picture" }, (c) => `${author} sent a picture`)
            .exhaustive()
        : "",
      sequenceId: message.sequenceId,
    };
  }

  return ok(result);
}

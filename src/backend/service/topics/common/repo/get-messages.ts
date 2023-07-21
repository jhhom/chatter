import { Message, UserId } from "~/api-contract/subscription/subscription";
import {
  KyselyDB,
  MessageDeleteLogs,
  Messages,
  TopicEventLogs,
  Users,
} from "~/backend/schema";
import { formatTopicEventLogMessage } from "~/backend/service/common/topics";
import { jsonObjectFrom, jsonArrayFrom } from "kysely/helpers/postgres";
import { InferResult } from "kysely";

type MessageResult = InferResult<ReturnType<typeof getMessagesQuery>>[number];

export function getMessagesQuery(
  db: KyselyDB,
  arg: {
    requesterUserId: UserId;
  }
) {
  const q = db
    .selectFrom("messages")
    .leftJoin(
      "topicEventLogs as messageEventLog",
      "messages.id",
      "messageEventLog.messageId"
    )
    .leftJoin("messageReplyLogs", "messages.id", "messageReplyLogs.messageId")
    .select((eb) => {
      return [
        "messages.content",
        "messages.sequenceId",
        "messages.authorId as author",
        "messages.createdAt",
        jsonObjectFrom(
          eb
            .selectFrom("topicEventLogs")
            .select([
              "topicEventLogs.topicEvent",
              "topicEventLogs.actorUserId",
              "topicEventLogs.affectedUserId",
              "topicEventLogs.createdAt",
            ])
            .whereRef("topicEventLogs.messageId", "=", "messages.id")
        ).as("topicEventLog"),
        jsonObjectFrom(
          eb
            .selectFrom("users")
            .select(["users.id as userId", "users.fullname as name"])
            .whereRef("users.id", "=", "messageEventLog.actorUserId")
        ).as("eventActor"),
        jsonObjectFrom(
          eb
            .selectFrom("users")
            .select(["users.id as userId", "users.fullname as name"])
            .whereRef("users.id", "=", "messageEventLog.affectedUserId")
        ).as("eventAffected"),
        jsonObjectFrom(
          eb
            .selectFrom("messages as replyToMessage")
            .select([
              "replyToMessage.sequenceId",
              "replyToMessage.content",
              "replyToMessage.authorId",
            ])
            .whereRef(
              "replyToMessage.id",
              "=",
              "messageReplyLogs.replyToMessage"
            )
        ).as("messageReplyTo"),
        jsonArrayFrom(
          eb
            .selectFrom("messageDeleteLogs")
            .select(["deletedFor"])
            .whereRef("messageDeleteLogs.messageId", "=", "messages.id")
            .where(({ eb, or, and }) =>
              or([
                eb("messageDeleteLogs.deletedFor", "=", "everyone"),
                and([
                  eb("messageDeleteLogs.deletedFor", "=", "self"),
                  eb("messageDeleteLogs.deletedBy", "=", arg.requesterUserId),
                ]),
              ])
            )
        ).as("messageDeleteLogs"),
      ];
    })
    .orderBy("messages.sequenceId", "desc");

  const p = q.compile();
  console.log(p);

  return q;
}

export function formatQueriedMessage(arg: { requesterUserId: UserId }) {
  const format = (m: MessageResult) => {
    if (m.author == null) {
      if (m.topicEventLog != undefined) {
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
          content: formatTopicEventLogMessage(m.topicEventLog.topicEvent, {
            actor: actorName,
            affected: affectedName,
          }),
          forwarded: false,
        };

        return {
          type: "event_log" as const,
          // the content here doesn't matter, we simply want to fit to the structure
          // of argument of `getIsFirstDateForMessages2`
          event: m.topicEventLog.topicEvent,
          content,
          createdAt: m.createdAt,
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
          createdAt: m.createdAt,
          sequenceId: m.sequenceId,
        };
      }
    } else {
      let deleted =
        m.messageDeleteLogs.findIndex((x) => x.deletedFor == "everyone") != -1;

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
          createdAt: m.createdAt,
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
        createdAt: m.createdAt,
        deleted,
      };
    }
  };
  return format;
}

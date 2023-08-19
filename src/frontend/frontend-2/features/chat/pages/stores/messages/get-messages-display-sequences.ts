import type { UserId } from "~/api-contract/subscription/subscription";
import type { Message } from "~/api-contract/subscription/subscription";
import type {
  TopicEventLog,
  ChatMessage,
} from "~/frontend/external/browser/indexed-db";

export type ChatMessageDisplaySeq = "first" | "last" | "middle" | "single";

export type ChatMessageType = ChatMessageTypeMessage | ChatMessageTypeEventLog;

export type ChatMessageTypeMessage = {
  type: "message";
  authorId: UserId;
  authorName: string;
  seq: ChatMessageDisplaySeq;
  userIsAuthor: boolean;
  read: boolean;
  date: Date;
  isFirstOfDate: boolean;
  text: ChatBubbleMessageContent;
  seqId: number;
  deleted: boolean;
};

type ChatMessageTypeEventLog = {
  type: "event_log";
  date: Date;
  isFirstOfDate: boolean;
  text: Message;
  seqId: number;
};

export type ChatBubbleMessageContent = Message & {
  replyTo: null | (Message & { seqId: number; authorName: string });
};

export type getMessageDisplaySequencesArg =
  | {
      authorId: UserId;
      authorName: string;
      userIsAuthor: boolean;
      read: boolean;
      createdAt: Date;
      content: ChatBubbleMessageContent;
      seqId: number;
      isFirstOfDate: boolean;
      type: "message";
      deleted: boolean;
    }
  | {
      type: "event_log";
      text: Extract<Message, { type: "text" }>;
      seqId: number;
      createdAt: Date;
      isFirstOfDate: boolean;
      read: boolean;
    };

/**
 *
 * @param input An array of messages sorted by their seqId in ascending order
 * @returns The output with each message attached their display `seq`
 */
export function getMessageDisplaySequences(
  input: getMessageDisplaySequencesArg[]
): ChatMessageType[] {
  const output: ChatMessageType[] = [];
  let currDate: Date | undefined = undefined;
  let prevAuthor: string | undefined = undefined;

  for (const [i, msg] of input.entries()) {
    if (msg.type == "event_log") {
      output.push({
        type: "event_log",
        text: msg.text,
        seqId: msg.seqId,
        date: msg.createdAt,
        isFirstOfDate: msg.isFirstOfDate,
      });
      prevAuthor = undefined;
      continue;
    }
    if (
      currDate == undefined ||
      currDate.toDateString() != msg.createdAt.toDateString()
    ) {
      currDate = msg.createdAt;
      prevAuthor = undefined;
    }

    let nextDate: Date | undefined = undefined;
    let nextAuthor: UserId | undefined = undefined;

    if (i < input.length - 1) {
      const next = input[i + 1];
      if (next.type == "message") {
        nextDate = next.createdAt;
        nextAuthor = next.authorId;
      }
    }

    let seq: "first" | "middle" | "last" | "single";

    const differentPrev =
      prevAuthor === undefined || prevAuthor !== msg.authorId;
    const differentNext = nextAuthor != msg.authorId || nextDate != currDate;

    if (differentPrev && differentNext) {
      seq = "single";
    } else if (!differentPrev && !differentNext) {
      seq = "middle";
    } else if (!differentPrev && differentNext) {
      seq = "last";
    } else {
      seq = "first";
    }

    output.push({
      type: "message",
      authorId: msg.authorId,
      authorName: msg.authorName,
      seq,
      date: msg.createdAt,
      text: msg.content,
      isFirstOfDate: msg.isFirstOfDate,
      read: msg.read,
      userIsAuthor: msg.userIsAuthor,
      seqId: msg.seqId,
      deleted: msg.deleted,
    });
    prevAuthor = msg.authorId;
  }

  return output;
}

export function sortMessagesAndEventLogs(
  messages: ChatMessage[],
  eventLogs: TopicEventLog[]
): (
  | (ChatMessage & { type: "message" })
  | (TopicEventLog & { type: "event_log" })
)[] {
  let results: (
    | (ChatMessage & { type: "message" })
    | (TopicEventLog & { type: "event_log" })
  )[] = [];

  const _messages = messages.map((m) => ({ ...m, type: "message" as const }));
  const _eventLogs = eventLogs.map((l) => ({
    ...l,
    type: "event_log" as const,
  }));

  results = [..._messages, ..._eventLogs];

  results = results.sort((a, b) => a.seqId - b.seqId);

  return results;
}

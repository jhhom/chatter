export type ChatMessageDisplaySeq = "first" | "last" | "middle" | "single";

export type ChatMessageType = ChatMessageTypeMessage | ChatMessageTypeEventLog;

export type ChatMessageTypeMessage = {
  type: "message";
  authorId: string;
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

type MessagePayload = {
  text: {
    forwarded: boolean;
    content: string;
  };
  picture: {
    filename: string;
    forwarded: boolean;
    url: string;
    caption: string;
    /** size in number of bytes */
    size: number;
  };
  file: {
    filename: string;
    forwarded: boolean;
    url: string;
    caption: string;
    /** size in number of bytes */
    size: number;
  };
};

export type Message = {
  [k in keyof MessagePayload]: { type: k } & MessagePayload[k];
}[keyof MessagePayload];

export type MessageReplied = Message & { seqId: number; authorName: string };

export type ChatBubbleMessageContent = Message & {
  replyTo: null | (Message & { seqId: number; authorName: string });
};

type ChatMessageMeta = {
  date: Date;
  isFirstOfDate: boolean;
  seqId: number;
};

export type ChatMessageMessage = {
  type: "message";
  authorId: string;
  authorName: string;
  seq: ChatMessageDisplaySeq;
  userIsAuthor: boolean;
  read: boolean;
  deleted: boolean;
  content: ChatBubbleMessageContent;
} & ChatMessageMeta;

export type ChatMessageEvent = {
  type: "event_log";
  content: Message;
};

export type ChatMessageProps = ChatMessageMessage | ChatMessageEvent;

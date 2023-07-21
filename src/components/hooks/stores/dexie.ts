import Dexie, { Table } from "dexie";

import { TopicEventType } from "~/backend/drizzle/schema";
import { UserId } from "~/backend/drizzle/schema";
import type { MessageContent } from "~/api-contract/subscription/subscription";

export type TopicId = UserId | `grp${string}`;

export type ChatMessage = {
  seqId: number;
  topicId: TopicId;
  content: MessageContent;
  author: UserId | null;
  createdAt: Date;
  read: boolean;
  deleted: boolean;
  isFirstOfDate: boolean;
};

export type TopicEventLog = {
  seqId: number;
  topicId: TopicId;
  topicEvent: TopicEventType;
};

class AppDexie extends Dexie {
  // https://dexie.org/docs/Typescript

  // https://stackoverflow.com/questions/64210806/compound-primary-keys-with-dexie-js-indexeddb-as-in-sql
  messages!: Table<ChatMessage, [TopicId, number]>;
  topicEventLogs!: Table<TopicEventLog, [TopicId, number]>;

  constructor() {
    super("tinode");
    // https://dexie.org/docs/Compound-Index
    this.version(1).stores({
      messages: "[topicId+seqId]",
      topicEventLogs: "[topicId+seqId]",
    });
  }
}

export const dexie = new AppDexie();

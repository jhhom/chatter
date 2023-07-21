import type { ColumnType, Kysely, Transaction } from "kysely";
import type { Message as MessageContent } from "~/api-contract/subscription/subscription";
import type {
  GroupTopicId,
  UserId,
  TopicId,
} from "~/api-contract/subscription/subscription";

export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;

export type Json = ColumnType<JsonValue, string, string>;

export type JsonArray = JsonValue[];

export type JsonObject = {
  [K in string]?: JsonValue;
};

export type JsonPrimitive = boolean | null | number | string;

export type JsonValue = JsonArray | JsonObject | JsonPrimitive;

export type MessageDeletedFor = "everyone" | "self";

export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export type TopicEvent =
  | "add_member"
  | "change_member_permission"
  | "create_group"
  | "join-group-through-id"
  | "join-group-through-invite-link"
  | "leave_group"
  | "remove_member";

export type TopicType = "group" | "p2p";

export type P2PTopicId = `p2p${string}`;

export interface GroupTopicMeta {
  id: Generated<number>;
  topicId: GroupTopicId;
  groupName: string;
  updatedAt: Generated<Timestamp>;
  createdAt: Generated<Timestamp>;
  defaultPermissions: string;
  inviteLink: string | null;
  archivedInviteLinks: string[] | null;
  profilePhotoUrl: string | null;
  ownerId: UserId;
}

export interface KnexMigrations {
  id: Generated<number>;
  name: string | null;
  batch: number | null;
  migrationTime: Timestamp | null;
}

export interface KnexMigrationsLock {
  index: Generated<number>;
  isLocked: number | null;
}

export interface MessageDeleteLogs {
  id: Generated<number>;
  messageId: number;
  deletedBy: string;
  deletedFor: MessageDeletedFor;
  createdAt: Generated<Timestamp>;
}

export interface MessageReplyLogs {
  messageId: number;
  replyToMessage: number;
  createdAt: Generated<Timestamp>;
}

export interface Messages {
  id: Generated<number>;
  sequenceId: Generated<number>;
  topicId: TopicId;
  authorId: UserId | null;
  updatedAt: Generated<Timestamp>;
  createdAt: Generated<Timestamp>;
  content: MessageContent | null;
}

export interface Subscriptions {
  id: Generated<number>;
  topicId: TopicId;
  userId: UserId;
  readSeqId: number | null;
  recvSeqId: number | null;
  updatedAt: Generated<Timestamp>;
  createdAt: Generated<Timestamp>;
  permissions: string;
}

export interface TopicEventLogMetaRemoveMember {
  id: number;
  readSeqId: number | null;
  recvSeqId: number | null;
  updatedAt: Generated<Timestamp>;
  createdAt: Generated<Timestamp>;
}

export interface TopicEventLogs {
  id: Generated<number>;
  messageId: number;
  topicEvent: TopicEvent;
  topicId: TopicId;
  actorUserId: UserId;
  affectedUserId: UserId | null;
  info: Json | null;
  createdAt: Generated<Timestamp>;
}

export interface Topics {
  id: TopicId;
  topicType: Generated<TopicType>;
  touchedAt: Timestamp | null;
  updatedAt: Generated<Timestamp>;
  createdAt: Generated<Timestamp>;
}

export interface Users {
  id: UserId;
  username: Generated<string>;
  fullname: Generated<string>;
  email: Generated<string>;
  password: Generated<string>;
  passwordHash: Generated<string>;
  userAgent: Generated<string>;
  updatedAt: Generated<Timestamp>;
  createdAt: Generated<Timestamp>;
  defaultPermissions: string;
  lastOnline: Timestamp | null;
  profilePhotoUrl: string | null;
}

export interface DB {
  groupTopicMeta: GroupTopicMeta;
  knexMigrations: KnexMigrations;
  knexMigrationsLock: KnexMigrationsLock;
  messageDeleteLogs: MessageDeleteLogs;
  messageReplyLogs: MessageReplyLogs;
  messages: Messages;
  subscriptions: Subscriptions;
  topicEventLogMetaRemoveMember: TopicEventLogMetaRemoveMember;
  topicEventLogs: TopicEventLogs;
  topics: Topics;
  users: Users;
}

export type KyselyDB = Kysely<DB>;

export type KyselyTransaction = Transaction<DB>;

export const CONSTRAINTS = {
  Subscriptions: {
    subscriptions_user_id_topic_id_key: "subscriptions_user_id_topic_id_key",
  },
} as const;

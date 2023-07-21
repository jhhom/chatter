import {
  pgTable,
  pgEnum,
  char,
  timestamp,
  serial,
  varchar,
  integer,
  uniqueIndex,
  text,
  jsonb,
} from "drizzle-orm/pg-core";
import type { Message } from "./message-type";

export const topicType = pgEnum("topic_type", ["group", "p2p"]);
export const topicEvent = pgEnum("topic_event", [
  "join-group-through-invite-link",
  "join-group-through-id",
  "create_group",
  "change_member_permission",
  "remove_member",
  "add_member",
  "leave_group",
]);
export const messageDeletedFor = pgEnum("message_deleted_for", [
  "self",
  "everyone",
]);

export type MessageDeleteForType = "self" | "everyone";

export type TopicEventType =
  | "change_member_permission"
  | "remove_member"
  | "add_member"
  | "create_group"
  | "join-group-through-invite-link"
  | "join-group-through-id"
  | "leave_group";

export type TopicId = GroupTopicId | P2PTopicId;
export type P2PTopicId = `p2p${string}`;
export type GroupTopicId = `grp${string}`;
export type UserId = `usr${string}`;

export const topics = pgTable("topics", {
  id: char("id", { length: 15 }).$type<TopicId>().notNull(),
  topicType: topicType("topic_type").default("p2p").notNull(),
  touchedAt: timestamp("touched_at", { mode: "string" }),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
});

export const knexMigrations = pgTable("knex_migrations", {
  id: serial("id").notNull(),
  name: varchar("name", { length: 255 }),
  batch: integer("batch"),
  migrationTime: timestamp("migration_time", {
    withTimezone: true,
    mode: "string",
  }),
});

export const knexMigrationsLock = pgTable("knex_migrations_lock", {
  index: serial("index").notNull(),
  isLocked: integer("is_locked"),
});

export const users = pgTable(
  "users",
  {
    id: char("id", { length: 15 }).$type<UserId>().notNull(),
    username: varchar("username", { length: 255 }).notNull(),
    fullname: varchar("fullname", { length: 255 }).default("").notNull(),
    email: varchar("email", { length: 255 }).default("").notNull(),
    password: varchar("password", { length: 255 }).default("").notNull(),
    passwordHash: text("password_hash").default("").notNull(),
    userAgent: varchar("user_agent", { length: 255 }).default("").notNull(),
    defaultPermissions: varchar("default_permissions", { length: 8 }).notNull(),
    profilePhotoUrl: text("profile_photo_url"),
    lastOnline: timestamp("last_online", { mode: "string" }),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      emailKey: uniqueIndex("users_email_key").on(table.email),
      usernameKey: uniqueIndex("users_username_key").on(table.username),
    };
  }
);

export const messages = pgTable(
  "messages",
  {
    id: serial("id").notNull(),
    content: jsonb("content").$type<Message>(),
    sequenceId: serial("sequence_id").notNull(),
    topicId: char("topic_id", { length: 15 })
      .$type<TopicId>()
      .notNull()
      .references(() => topics.id),
    authorId: char("author_id", { length: 15 })
      .$type<UserId>()
      .references(() => users.id),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      sequenceIdKey: uniqueIndex("messages_sequence_id_key").on(
        table.sequenceId
      ),
    };
  }
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: serial("id").notNull(),
    topicId: char("topic_id", { length: 15 })
      .$type<TopicId>()
      .notNull()
      .references(() => topics.id),
    userId: char("user_id", { length: 15 })
      .$type<UserId>()
      .notNull()
      .references(() => users.id),
    readSeqId: integer("read_seq_id").references(() => messages.sequenceId),
    recvSeqId: integer("recv_seq_id").references(() => messages.sequenceId),
    permissions: varchar("permissions", { length: 8 }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      userIdTopicIdKey: uniqueIndex("subscriptions_user_id_topic_id_key").on(
        table.topicId,
        table.userId
      ),
    };
  }
);

export const groupTopicMeta = pgTable(
  "group_topic_meta",
  {
    id: serial("id").notNull(),
    topicId: char("topic_id", { length: 15 })
      .$type<TopicId>()
      .notNull()
      .references(() => topics.id),
    groupName: varchar("group_name", { length: 255 }).notNull(),
    defaultPermissions: varchar("default_permissions", { length: 8 }).notNull(),
    inviteLink: char("invite_link", { length: 25 }),
    archivedInviteLinks: char("archived_invite_links", { length: 25 }).array(),
    profilePhotoUrl: text("profile_photo_url"),
    ownerId: char("owner_id", { length: 15 })
      .$type<UserId>()
      .notNull()
      .references(() => users.id),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      topicIdKey: uniqueIndex("group_topic_meta_topic_id_key").on(
        table.topicId
      ),
    };
  }
);

export const topicEventLogs = pgTable(
  "topic_event_logs",
  {
    id: serial("id").notNull(),
    messageId: integer("message_id")
      .notNull()
      .references(() => messages.id),
    topicEvent: topicEvent("topic_event").notNull(),
    topicId: char("topic_id", { length: 15 })
      .$type<TopicId>()
      .notNull()
      .references(() => topics.id),
    actorUserId: char("actor_user_id", { length: 15 })
      .$type<UserId>()
      .notNull()
      .references(() => users.id),
    affectedUserId: char("affected_user_id", { length: 15 })
      .$type<UserId>()
      .references(() => users.id),
    info: jsonb("info"),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      messageIdKey: uniqueIndex("topic_event_logs_message_id_key").on(
        table.messageId
      ),
    };
  }
);

export const topicEventLogMetaRemoveMember = pgTable(
  "topic_event_log_meta_remove_member",
  {
    id: integer("id")
      .notNull()
      .references(() => topicEventLogs.id),
    readSeqId: integer("read_seq_id").references(() => messages.sequenceId),
    recvSeqId: integer("recv_seq_id").references(() => messages.sequenceId),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  }
);

export const messageReplyLogs = pgTable("message_reply_logs", {
  messageId: integer("message_id")
    .notNull()
    .references(() => messages.id),
  replyToMessage: integer("reply_to_message")
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
});

export const messageDeleteLogs = pgTable(
  "message_delete_logs",
  {
    id: serial("id").notNull(),
    messageId: integer("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    deletedBy: char("deleted_by", { length: 15 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deletedFor: messageDeletedFor("deleted_for").notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      messageDeletedForEveryoneIdx: uniqueIndex(
        "message_deleted_for_everyone_idx"
      ).on(table.messageId),
      messageDeletedForSelfIdx: uniqueIndex("message_deleted_for_self_idx").on(
        table.messageId,
        table.deletedBy
      ),
    };
  }
);

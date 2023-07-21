import { z } from "zod";
import { zGroupId, zUserId } from "~/api-contract/common/common";

const messageTextSchema = z.object({
  type: z.literal("text"),
  forwarded: z.boolean(),
  content: z.string(),
});

const messagePictureSchema = z.object({
  type: z.literal("picture"),
  filename: z.string(),
  forwarded: z.boolean(),
  url: z.string(),
  caption: z.string(),
  size: z.number(),
});

const messageFileSchema = z.object({
  type: z.literal("file"),
  filename: z.string(),
  forwarded: z.boolean(),
  url: z.string(),
  caption: z.string(),
  size: z.number(),
});

const topicEvent = z.enum([
  "join-group-through-invite-link",
  "join-group-through-id",
  "create_group",
  "change_member_permission",
  "remove_member",
  "add_member",
  "leave_group",
]);

const replyToMessageExtraInfoSchema = {
  seqId: z.number().int(),
  authorId: zUserId,
};

const replyToMessageContentSchema = z.discriminatedUnion("type", [
  messageFileSchema.extend(replyToMessageExtraInfoSchema),
  messageTextSchema.extend(replyToMessageExtraInfoSchema),
  messagePictureSchema.extend(replyToMessageExtraInfoSchema),
]);

const messageWithReplyContentSchema = z.discriminatedUnion("type", [
  messageFileSchema.extend({
    replyTo: replyToMessageContentSchema.nullable(),
  }),
  messageTextSchema.extend({
    replyTo: replyToMessageContentSchema.nullable(),
  }),
  messagePictureSchema.extend({
    replyTo: replyToMessageContentSchema.nullable(),
  }),
]);

export const getMessageAPIReturnValueMessage = z.object({
  msgs: z.array(
    z.discriminatedUnion("type", [
      z.object({
        read: z.boolean(),
        type: z.literal("event_log"),
        event: topicEvent,
        content: messageTextSchema,
        sequenceId: z.number().int(),
        createdAt: z.date(),
        isFirstOfDate: z.boolean(),
      }),
      z.object({
        read: z.boolean(),
        type: z.literal("message"),
        author: zUserId,
        deleted: z.boolean(),
        content: messageWithReplyContentSchema,
        sequenceId: z.number(),
        createdAt: z.date(),
        isFirstOfDate: z.boolean(),
      }),
    ])
  ),
  hasEarlierMessages: z.boolean(),
});

// -------------------

const getUnreadMessageTopic = z.object({
  name: z.string(),
});

const getUnreadMessageMessage = z.object({
  content: messageWithReplyContentSchema,
  sequenceId: z.number().int(),
  createdAt: z.date(),
  isFirstOfDate: z.boolean(),
  author: zUserId,
  deleted: z.boolean(),
  read: z.boolean(),
});

const getUnreadMessageEventLog = z.object({
  content: messageTextSchema,
  read: z.boolean(),
  event: topicEvent,
  sequenceId: z.number(),
  createdAt: z.date(),
  isFirstOfDate: z.boolean(),
});

export const getUnreadMessageAPIReturnValue = z.object({
  p2pTopics: z.array(
    z.object({
      topic: getUnreadMessageTopic.extend({
        id: zUserId,
      }),
      messages: z.array(getUnreadMessageMessage),
      eventLogs: z.array(getUnreadMessageEventLog),
    })
  ),
  grpTopics: z.array(
    z.object({
      topic: getUnreadMessageTopic.extend({
        id: zGroupId,
      }),
      messages: z.array(getUnreadMessageMessage),
      eventLogs: z.array(getUnreadMessageEventLog),
    })
  ),
});

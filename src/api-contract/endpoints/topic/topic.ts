import { z } from "zod";
import { zUserOrGroupId, zUserId } from "~/api-contract/common/common";
import {
  getMessageAPIReturnValueMessage,
  getUnreadMessageAPIReturnValue,
} from "~/api-contract/endpoints/topic/message";

const messageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), content: z.string() }),
  z.object({
    type: z.literal("picture"),
    base64: z.string().min(1),
    caption: z.string(),
    filename: z.string().min(1),
  }),
  z.object({
    type: z.literal("file"),
    base64: z.string(),
    caption: z.string(),
    filename: z.string().min(1),
  }),
]);

export const lastMessageOfTopicSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("deleted"),
    sequenceId: z.number().int(),
  }),
  z.object({
    type: z.literal("message"),
    content: z.string(),
    sequenceId: z.number().int(),
  }),
]);

export const contract = {
  "topic/reply_message": {
    input: z.object({
      content: messageSchema,
      receiverId: zUserOrGroupId,
      replyToMessageSeqId: z.number(),
    }),
    output: z.unknown(),
  },
  "topic/delete_message": {
    input: z.object({
      topicId: zUserOrGroupId,
      messageSeqId: z.number(),
      deleteFor: z.enum(["self", "everyone"]),
    }),
    output: z.unknown(),
  },
  "topic/clear_messages": {
    input: z.object({
      topicId: zUserOrGroupId,
    }),
    output: z.unknown(),
  },
  "topic/messages": {
    input: z.object({
      topicId: zUserOrGroupId,
      beforeSequenceId: z.number(),
      numberOfMessages: z.number().default(15),
    }),
    output: getMessageAPIReturnValueMessage,
  },
  "topic/unread_messages": {
    output: getUnreadMessageAPIReturnValue,
  },
  "topic/get_messages_until_reply": {
    input: z.object({
      topicId: zUserOrGroupId,
      beforeSequenceId: z.number().int(),
      untilReplySequenceId: z.number().int(),
    }),
    output: getMessageAPIReturnValueMessage,
  },
  "topic/has_messages_earlier_than": {
    input: z.object({
      topicId: zUserOrGroupId,
      beforeSequenceId: z.number(),
    }),
    output: z.boolean(),
  },
  "topic/update_message_read_status": {
    input: z.object({
      sequenceId: z.number().int(),
      topicId: zUserOrGroupId,
    }),
    output: z.unknown(),
  },
  "topic/forward_message": {
    input: z.object({
      message: z.object({
        seqId: z.number(),
        topicId: zUserOrGroupId,
      }),
      forwardTo: zUserOrGroupId,
    }),
    output: z.unknown(),
  },

  "topic/send_message": {
    input: z.object({
      content: messageSchema,
      receiverUserId: zUserOrGroupId,
    }),
    output: z.unknown(),
  },
  "topic/preview_info": {
    input: z.object({
      topicId: zUserOrGroupId,
    }),
    output: z.discriminatedUnion("type", [
      z.object({
        type: z.literal("user already has contact"),
        value: z.object({ name: z.string() }),
      }),
      z.object({
        type: z.literal("new p2p contact"),
        value: z.object({
          name: z.string(),
          profilePhotoUrl: z.string().nullable(),
          defaultPermissions: z.string(),
        }),
      }),
      z.object({
        type: z.literal("new group contact"),
        value: z.object({
          name: z.string(),
          profilePhotoUrl: z.string().nullable(),
        }),
      }),
    ]),
  },
  "topic/notify_typing": {
    input: z.object({
      action: z.enum(["typing", "stop-typing"]),
      contactUserId: zUserOrGroupId,
    }),
    output: z.unknown(),
  },
};

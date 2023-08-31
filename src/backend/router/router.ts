import type { IContext } from "~/backend/router/context";
import { initTRPC, TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { SubscriptionMessage } from "~/api-contract/subscription/subscription";
import superjson from "superjson";

import { authUsecase } from "~/backend/service/auth";
import { userUsecase } from "~/backend/service/users";
import { topicUsecase } from "~/backend/service/topics";

import { OnlineUsers } from "~/backend/service/common/online-users";

import type { UserId } from "~/api-contract/subscription/subscription";
import type { Socket } from "~/backend/service/common/socket";
import { contract } from "~/api-contract/endpoints";
import { serializeTRPCSourceError } from "~/backend/router/error-formatter";

const t = initTRPC.context<IContext>().create({
  transformer: superjson,
  errorFormatter: (opts) => {
    return serializeTRPCSourceError(opts);
  },
});
const router = t.router;
const procedure = t.procedure;

const onlineUsers = new OnlineUsers();

const isAuthed = t.middleware(async ({ ctx, next }) => {
  if (!(ctx.ctx.socket && ctx.ctx.auth)) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next({
    ctx: {
      ctx: {
        config: ctx.config,
        setAuth: (
          userId: UserId,
          username: string,
          email: string,
          socketId: string
        ) => ctx.ctx.setAuth(userId, username, email, socketId),
        resetAuth: () => ctx.ctx.resetAuth(),
        setSocket: (s: Socket | undefined) => ctx.ctx.setSocket(s),
        socket: ctx.ctx.socket,
        auth: ctx.ctx.auth,
        session: ctx.ctx.session,
        db: ctx.ctx.db,
      },
      opts: ctx.opts,
    },
  });
});

const authProcedure = procedure.use(isAuthed);

const mainRouter = router({
  ["users/create_user"]: procedure
    .input(contract["users/create_user"].input)
    .output(contract["users/create_user"].output)
    .mutation(async ({ input, ctx }) => {
      const result = await userUsecase.registerUser(ctx.ctx.db, input, {
        projectRoot: ctx.config.PROJECT_ROOT,
      });
      if (result.isErr()) {
        throw result.error;
      }
      return result.value;
    }),
  ["group/add_members"]: authProcedure
    .input(contract["group/add_members"].input)
    .output(contract["group/add_members"].output)
    .mutation(async ({ input, ctx }) => {
      const result = await topicUsecase.addMembersToGroup(
        { db: ctx.ctx.db, onlineUsers },
        {
          adderUserId: ctx.ctx.auth.userId,
          membersToAdd: input.membersToAdd,
          groupTopicId: input.groupTopicId,
        }
      );
      if (result.isErr()) {
        throw result.error;
      }
      return result.value;
    }),
  ["group/find_new_members"]: authProcedure
    .input(contract["group/find_new_members"].input)
    .output(contract["group/find_new_members"].output)
    .mutation(async ({ input, ctx }) => {
      const result = await topicUsecase.findNewMembersForGroup(ctx.ctx.db, {
        requesterUserId: ctx.ctx.auth.userId,
        groupTopicId: input.groupTopicId,
        searchQueryUsername: input.searchQueryUsername,
      });
      if (result.isErr()) {
        throw result.error;
      }
      return result.value;
    }),
  ["group/create_group"]: authProcedure
    .input(contract["group/create_group"].input)
    .output(contract["group/create_group"].output)
    .mutation(async ({ input, ctx }) => {
      const result = await topicUsecase.createGroupTopic(
        { db: ctx.ctx.db, onlineUsers },
        {
          creatorId: ctx.ctx.auth.userId,
          groupName: input.groupName,
          photoBase64: input.photoBase64,
        },
        {
          projectRoot: ctx.config.PROJECT_ROOT,
        }
      );
      if (result.isErr()) {
        console.log("❌");
        console.log(result.error);
        throw result.error;
      }
      return result.value;
    }),
  ["group/preview_info"]: procedure
    .input(contract["group/preview_info"].input)
    .output(contract["group/preview_info"].output)
    .query(async ({ input, ctx }) => {
      const result = await topicUsecase.getGroupPreviewInfo(
        ctx.ctx.db,
        input.groupInviteLinkId
      );
      if (result.isErr()) {
        throw result.error;
      }
      console.log("RESULT", result.value);
      return result.value;
    }),
  ["topic/preview_info"]: authProcedure
    .input(contract["topic/preview_info"].input)
    .output(contract["topic/preview_info"].output)
    .query(async ({ input, ctx }) => {
      const result = await topicUsecase.getContactPreviewInfo(ctx.ctx.db, {
        topicId: input.topicId,
        requesterUserId: ctx.ctx.auth.userId,
      });
      if (result.isErr()) {
        throw result.error;
      }
      return result.value;
    }),
  ["group/members"]: authProcedure
    .input(contract["group/members"].input)
    .output(contract["group/members"].output)
    .query(async ({ input, ctx }) => {
      const result = await topicUsecase.getGroupMembers(
        { db: ctx.ctx.db, onlineUsers },
        { groupTopicId: input.groupTopicId }
      );
      if (result.isErr()) {
        throw result.error;
      }
      return result.value;
    }),
  ["group/am_i_group_member_of"]: authProcedure
    .input(contract["group/am_i_group_member_of"].input)
    .output(contract["group/am_i_group_member_of"].output)
    .query(async ({ input, ctx }) => {
      const result = await topicUsecase.isUserAlreadyAMemberOfGroup(
        ctx.ctx.db,
        { groupTopicId: input.groupTopicId, userId: ctx.ctx.auth.userId }
      );
      if (result.isErr()) {
        throw result.error;
      }
      return result.value;
    }),
  ["group/invite_link"]: authProcedure
    .input(contract["group/invite_link"].input)
    .output(contract["group/invite_link"].output)
    .query(async ({ input, ctx }) => {
      const result = await topicUsecase.getGroupInviteLink(
        ctx.ctx.db,
        input.groupTopicId
      );
      if (result.isErr()) {
        throw result.error;
      }
      return result.value;
    }),
  ["topic/notify_typing"]: authProcedure
    .input(contract["topic/notify_typing"].input)
    .output(contract["topic/notify_typing"].output)
    .mutation(async ({ input, ctx }) => {
      await topicUsecase.notifyIsTyping(
        { onlineUsers, db: ctx.ctx.db },
        {
          action: input.action,
          notifierId: ctx.ctx.auth.userId,
          topicId: input.contactUserId,
        }
      );
    }),
  ["auth/login_with_token"]: procedure
    .input(contract["auth/login_with_token"].input)
    .output(contract["auth/login_with_token"].output)
    .mutation(async ({ input, ctx }) => {
      const result = await authUsecase.autoLogin(
        { onlineUsers },
        {
          jwtToken: input.jwtToken,
          userCtx: ctx.ctx,
        }
      );
      if (result.isErr()) {
        throw result.error;
      }
      return result.value;
    }),
  ["auth/logout"]: authProcedure
    .output(contract["auth/logout"].output)
    .mutation(async ({ ctx }) => {
      const result = await authUsecase.logout(
        { db: ctx.ctx.db, onlineUsers },
        { ctx: ctx.ctx }
      );
      if (result.isErr()) {
        throw result.error;
      }
      return result.value;
    }),
  ["auth/login"]: procedure
    .input(contract["auth/login"].input)
    .output(contract["auth/login"].output)
    .mutation(async ({ input, ctx }) => {
      const result = await authUsecase.login(
        { onlineUsers },
        { ...input, userCtx: ctx.ctx }
      );
      if (result.isErr()) {
        throw result.error;
      }
      return result.value;
    }),
  ["users/find_users_to_add_as_contact"]: authProcedure
    .input(contract["users/find_users_to_add_as_contact"].input)
    .output(contract["users/find_users_to_add_as_contact"].output)
    .query(async ({ input, ctx }) => {
      const result = await userUsecase.findUsersToAddContact(
        ctx.ctx.db,
        input.email
      );
      if (result.isErr()) {
        throw result.error;
      }
      return result.value;
    }),
  registerSocket: procedure.subscription(({ input, ctx }) => {
    const callback = authUsecase.registerSocket(
      { onlineUsers, db: ctx.ctx.db },
      { userCtx: ctx.ctx }
    );
    return observable<SubscriptionMessage>(callback);
  }),
  ["topic/send_message"]: authProcedure
    .input(contract["topic/send_message"].input)
    .output(contract["topic/send_message"].output)
    .mutation(async ({ input, ctx }) => {
      const result = await topicUsecase.sendMessage(
        { db: ctx.ctx.db, currentOnlineUsers: onlineUsers },
        {
          content: input.content,
          topicId: input.receiverUserId,
          authorId: ctx.ctx.auth.userId,
        },
        {
          projectRoot: ctx.config.PROJECT_ROOT,
        }
      );
      if (result.isErr()) {
        throw result.error;
      }
      return result.value;
    }),
  ["topic/forward_message"]: authProcedure
    .input(contract["topic/forward_message"].input)
    .output(contract["topic/forward_message"].output)
    .mutation(async ({ input, ctx }) => {
      const result = await topicUsecase.forwardMessage(
        { db: ctx.ctx.db, onlineUsers },
        {
          forwarder: ctx.ctx.auth.userId,
          forwardedMessage: {
            seqId: input.message.seqId,
            topicId: input.message.topicId,
          },
          forwardedTo: input.forwardTo,
        }
      );
      if (result.isErr()) {
        throw result.error;
      }
      return result.value;
    }),
  ["topic/reply_message"]: authProcedure
    .input(contract["topic/reply_message"].input)
    .output(contract["topic/reply_message"].output)
    .mutation(async ({ input, ctx }) => {
      const result = await topicUsecase.replyMessage(
        { db: ctx.ctx.db, currentOnlineUsers: onlineUsers },
        {
          content: input.content,
          topicId: input.receiverId,
          authorId: ctx.ctx.auth.userId,
          replyToMessageSeqId: input.replyToMessageSeqId,
        },
        {
          projectRoot: ctx.config.PROJECT_ROOT,
        }
      );
      if (result.isErr()) {
        console.log("boom", result.error);
        throw result.error;
      }
      return result.value;
      9;
    }),
  ["topic/delete_message"]: authProcedure
    .input(contract["topic/delete_message"].input)
    .output(contract["topic/delete_message"].output)
    .mutation(async ({ input, ctx }) => {
      const result = await topicUsecase.deleteMessage(
        { db: ctx.ctx.db, onlineUsers },
        {
          deleterUserId: ctx.ctx.auth.userId,
          topicId: input.topicId,
          messageSeqId: input.messageSeqId,
          deleteFor: input.deleteFor,
        }
      );
      if (result.isErr()) {
        console.log("boom", result.error);
        throw result.error;
      }
      return {};
    }),
  ["topic/clear_messages"]: authProcedure
    .input(contract["topic/clear_messages"].input)
    .output(contract["topic/clear_messages"].output)
    .mutation(async ({ input, ctx }) => {
      const result = await topicUsecase.clearMessages(ctx.ctx.db, {
        topicId: input.topicId,
        requesterUserId: ctx.ctx.auth.userId,
      });
      if (result.isErr()) {
        throw result.error;
      }
      return {};
    }),
  ["users/topics"]: authProcedure
    .output(contract["users/topics"].output)
    .query(async ({ ctx }) => {
      const result = await topicUsecase.getUserTopics(
        ctx.ctx.db,
        ctx.ctx.auth.userId
      );
      if (result.isErr()) {
        throw result.error;
      }
      console.log("BOOM");
      console.log(JSON.stringify(result.value));
      return result.value;
    }),
  ["users/contact_status"]: authProcedure
    .output(contract["users/contact_status"].output)
    .query(async ({ ctx }) => {
      const result = await topicUsecase.getContactStatus(
        { db: ctx.ctx.db, onlineUsers },
        { userId: ctx.ctx.auth.userId }
      );
      if (result.isErr()) {
        throw result.error;
      }
      return result.value;
    }),
  ["topic/messages"]: authProcedure
    .input(contract["topic/messages"].input)
    .output(contract["topic/messages"].output)
    .query(async ({ input, ctx }) => {
      const result = await topicUsecase.getMessages(ctx.ctx.db, {
        requesterUserId: ctx.ctx.auth.userId,
        topicId: input.topicId,
        numberOfMessages: input.numberOfMessages,
        beforeSequenceId: input.beforeSequenceId,
      });
      if (result.isErr()) {
        throw result.error;
      }
      return result.value;
    }),
  ["topic/get_messages_until_reply"]: authProcedure
    .input(contract["topic/get_messages_until_reply"].input)
    .output(contract["topic/get_messages_until_reply"].output)
    .query(async ({ input, ctx }) => {
      const result = await topicUsecase.getMessagesUntilReply(ctx.ctx.db, {
        requesterUserId: ctx.ctx.auth.userId,
        topicId: input.topicId,
        untilReplySequenceId: input.untilReplySequenceId,
        beforeSequenceId: input.beforeSequenceId,
      });
      if (result.isErr()) {
        throw result.error;
      }
      return result.value;
    }),
  ["topic/has_messages_earlier_than"]: authProcedure
    .input(contract["topic/has_messages_earlier_than"].input)
    .output(contract["topic/has_messages_earlier_than"].output)
    .query(async ({ input, ctx }) => {
      const result = await topicUsecase.hasMessagesEarlierThan(ctx.ctx.db, {
        requesterUserId: ctx.ctx.auth.userId,
        topicId: input.topicId,
        beforeSequenceId: input.beforeSequenceId,
      });
      if (result.isErr()) {
        throw result.error;
      }
      return result.value;
    }),
  ["topic/update_message_read_status"]: authProcedure
    .input(contract["topic/update_message_read_status"].input)
    .output(contract["topic/update_message_read_status"].output)
    .mutation(async ({ input, ctx }) => {
      const result = await topicUsecase.updateMessageReadStatus(
        {
          db: ctx.ctx.db,
          onlineUsers,
        },
        {
          readSequenceId: input.sequenceId,
          updaterUserId: ctx.ctx.auth.userId,
          topicId: input.topicId,
        }
      );
      if (result.isErr()) {
        throw result.error;
      }
      return result.value;
    }),

  ["group/join_group_via_id"]: authProcedure
    .input(contract["group/join_group_via_id"].input)
    .output(contract["group/join_group_via_id"].output)
    .mutation(async ({ ctx, input }) => {
      const r = await topicUsecase.joinGroupViaId(
        {
          db: ctx.ctx.db,
          onlineUsers,
        },
        {
          userId: ctx.ctx.auth.userId,
          userSocketId: ctx.ctx.auth.socketId,
          groupId: input.groupTopicId,
        }
      );
      if (r.isErr()) {
        throw r.error;
      }
      return r.value;
    }),
  ["group/leave_group"]: authProcedure
    .input(contract["group/leave_group"].input)
    .output(contract["group/leave_group"].output)
    .mutation(async ({ ctx, input }) => {
      const r = await topicUsecase.leaveGroup(
        {
          db: ctx.ctx.db,
          onlineUsers,
        },
        {
          memberId: ctx.ctx.auth.userId,
          groupTopicId: input.groupTopicId,
        }
      );
      if (r.isErr()) {
        throw r.error;
      }
      return r.value;
    }),
  ["group/join_group_via_invite_link"]: authProcedure
    .input(contract["group/join_group_via_invite_link"].input)
    .output(contract["group/join_group_via_invite_link"].output)
    .mutation(async ({ ctx, input }) => {
      const r = await topicUsecase.joinGroupViaInviteLink(
        {
          db: ctx.ctx.db,
          onlineUsers,
        },
        {
          userId: ctx.ctx.auth.userId,
          userSocketId: ctx.ctx.auth.socketId,
          groupInviteLinkId: input.inviteLinkId,
        }
      );
      if (r.isErr()) {
        throw r.error;
      }
      return r.value;
    }),

  ["topic/unread_messages"]: authProcedure
    .output(contract["topic/unread_messages"].output)
    .query(async ({ ctx }) => {
      const result = await topicUsecase.getAllUnreadMessages(
        ctx.ctx.db,
        ctx.ctx.auth.userId
      );
      if (result.isErr()) {
        throw result.error;
      }
      return result.value;
    }),
  ["group/remove_member"]: authProcedure
    .input(contract["group/remove_member"].input)
    .output(contract["group/remove_member"].output)
    .mutation(async ({ ctx, input }) => {
      const result = await topicUsecase.removeGroupMember(
        { db: ctx.ctx.db, onlineUsers },
        {
          groupTopicId: input.groupTopicId,
          memberId: input.memberId,
          removerUserId: ctx.ctx.auth.userId,
        }
      );
      if (result.isErr()) {
        throw result.error;
      }
      return result.value;
    }),
  ["permissions/update_user_default_permission"]: authProcedure
    .input(contract["permissions/update_user_default_permission"].input)
    .output(contract["permissions/update_user_default_permission"].output)
    .mutation(async ({ ctx, input }) => {
      const r = await topicUsecase.updateUserDefaultPermission(ctx.ctx.db, {
        userId: ctx.ctx.auth.userId,
        newPermission: input.newPermission,
      });
      if (r.isErr()) {
        throw r.error;
      }
      return r.value;
    }),
  ["permissions/update_peer_permission"]: authProcedure
    .input(contract["permissions/update_peer_permission"].input)
    .output(contract["permissions/update_peer_permission"].output)
    .mutation(async ({ ctx, input }) => {
      const r = await topicUsecase.updatePeerPermission(
        {
          db: ctx.ctx.db,
          onlineUsers,
        },
        {
          requesterUserId: ctx.ctx.auth.userId,
          peerId: input.peerId,
          newPermission: input.newPermission,
        }
      );
      if (r.isErr()) {
        throw r.error;
      }
      return r.value;
    }),
  ["permissions/block_peer"]: authProcedure
    .input(contract["permissions/block_peer"].input)
    .output(contract["permissions/block_peer"].output)
    .mutation(async ({ ctx, input }) => {
      const r = await topicUsecase.blockPeer(
        { db: ctx.ctx.db, onlineUsers },
        {
          requesterUserId: ctx.ctx.auth.userId,
          peerId: input.peerId,
        }
      );
      if (r.isErr()) {
        throw r.error;
      }
      return r.value;
    }),
  ["permissions/update_group_default_permission"]: authProcedure
    .input(contract["permissions/update_group_default_permission"].input)
    .output(contract["permissions/update_group_default_permission"].output)
    .mutation(async ({ ctx, input }) => {
      const r = await topicUsecase.updateGroupDefaultPermission(
        { db: ctx.ctx.db, onlineUsers },
        {
          requesterUserId: ctx.ctx.auth.userId,
          groupTopicId: input.groupTopicId,
          newDefaultPermission: input.newDefaultPermission,
        }
      );
      if (r.isErr()) {
        throw r.error;
      }
      return r.value;
    }),
  ["permissions/update_group_member_permission"]: authProcedure
    .input(contract["permissions/update_group_member_permission"].input)
    .output(contract["permissions/update_group_member_permission"].output)
    .mutation(async ({ ctx, input }) => {
      const r = await topicUsecase.updateGroupMemberPermission(
        { db: ctx.ctx.db, onlineUsers },
        {
          memberUserId: input.memberUserId,
          groupTopicId: input.groupTopicId,
          newPermission: input.newPermission,
        }
      );
      if (r.isErr()) {
        throw r.error;
      }
      return r.value;
    }),
  ["permissions/get_group_member_permission"]: authProcedure
    .input(contract["permissions/get_group_member_permission"].input)
    .output(contract["permissions/get_group_member_permission"].output)
    .query(async ({ ctx, input }) => {
      const r = await topicUsecase.getMemberPermissionInGroup(ctx.ctx.db, {
        memberUserId: input.memberUserId,
        groupTopicId: input.groupTopicId,
      });
      if (r.isErr()) {
        throw r.error;
      }
      return r.value;
    }),
});

export { mainRouter };

export type IAppRouter = typeof mainRouter;

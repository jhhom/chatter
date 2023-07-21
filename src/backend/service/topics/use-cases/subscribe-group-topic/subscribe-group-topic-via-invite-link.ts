import { InferModel, eq } from "drizzle-orm";
import { fromPromise, err, ok } from "neverthrow";

import { OnlineUsers } from "~/backend/service/common/online-users";
import { AppPgDatabase } from "~/backend/drizzle/db";
import {
  GroupTopicId,
  UserId,
  groupTopicMeta,
  subscriptions,
  users,
  messages,
  topicEventLogs,
} from "~/backend/drizzle/schema";
import {
  getPrecedingMessageDate,
  getGroupMembers,
} from "~/backend/service/topics/common/repo";
import { permission } from "~/backend/common/permissions";
import { completeMediaUrl } from "~/backend/service/topics/use-cases/send-message/media";

import { ServiceResult } from "~/api-contract/types";
import { AppError } from "~/api-contract/errors/errors";

export async function subscribeToGroupTopicViaInviteLink(
  ctx: {
    db: AppPgDatabase;
    onlineUsers: OnlineUsers;
  },
  arg: {
    userId: UserId;
    userSocketId: string;
    groupInviteLinkId: string;
  }
): ServiceResult<"group/join_group_via_invite_link"> {
  const defaultGroupPermissionResult = await fromPromise(
    ctx.db
      .select({
        groupId: groupTopicMeta.topicId,
        defaultGroupPermissions: groupTopicMeta.defaultPermissions,
      })
      .from(groupTopicMeta)
      .where(eq(groupTopicMeta.inviteLink, arg.groupInviteLinkId)),
    (e) => new AppError("DATABASE", { cause: e })
  ).andThen((v) => {
    if (v.length == 0) {
      return err(
        new AppError("RESOURCE_NOT_FOUND", { resource: "group meta" })
      );
    }
    return ok(v[0]);
  });

  if (defaultGroupPermissionResult.isErr()) {
    return err(defaultGroupPermissionResult.error);
  }
  const groupId = defaultGroupPermissionResult.value.groupId as GroupTopicId;
  const defaultGroupPermission =
    defaultGroupPermissionResult.value.defaultGroupPermissions;

  if (!permission(defaultGroupPermission).canJoin()) {
    return err(new AppError("GROUP.NO_JOIN_PERMISSION", undefined));
  }

  const result = await fromPromise(
    ctx.db.transaction(async (tx) => {
      // 1. create a subscription
      const subscription = (
        await tx
          .insert(subscriptions)
          .values({
            topicId: groupId,
            userId: arg.userId,
            permissions: defaultGroupPermission,
          })
          .returning()
      )[0];

      // 2. create a topic event log
      const actorResult = await tx
        .select({
          name: users.fullname,
          profilePhotoUrl: users.profilePhotoUrl,
        })
        .from(users)
        .where(eq(users.id, arg.userId));
      if (actorResult.length == 0) {
        throw new Error("No actor result returned");
      }
      const actor = {
        name: actorResult[0].name,
        profilePhotoUrl: actorResult[0].profilePhotoUrl
          ? completeMediaUrl(actorResult[0].profilePhotoUrl)
          : null,
      };

      const msg = (
        await tx
          .insert(messages)
          .values({
            topicId: groupId,
          })
          .returning({
            id: messages.id,
            sequenceId: messages.sequenceId,
            createdAt: messages.createdAt,
          })
      )[0];

      const precedingDate = await getPrecedingMessageDate(tx, {
        topicId: groupId,
        beforeSequenceId: msg.sequenceId,
      });
      if (precedingDate.isErr()) {
        throw precedingDate.error;
      }

      const log: InferModel<typeof topicEventLogs, "insert"> = {
        topicEvent: "join-group-through-invite-link",
        topicId: groupId,
        actorUserId: arg.userId,
        affectedUserId: null,
        messageId: msg.id,
      };

      await tx.insert(topicEventLogs).values(log);

      return {
        subscription,
        isFirstOfDate: precedingDate.value
          ? new Date(precedingDate.value).toDateString() !=
            new Date(msg.createdAt).toDateString()
          : true,
        sequenceId: msg.sequenceId,
        createdAt: new Date(msg.createdAt),
        subscribed: actor,
        subscribedUserId: arg.userId,
      };
    }),
    (e) => new AppError("UNKNOWN", { cause: e })
  );
  if (result.isErr()) {
    return err(result.error);
  }

  // 2. get the group topic information
  const groupTopicResult = await fromPromise(
    ctx.db
      .select({
        groupName: groupTopicMeta.groupName,
        defaultPermissions: groupTopicMeta.defaultPermissions,
        profilePhotoUrl: groupTopicMeta.profilePhotoUrl,
        ownerId: groupTopicMeta.ownerId,
      })
      .from(groupTopicMeta)
      .where(eq(groupTopicMeta.topicId, groupId)),
    (e) => new AppError("DATABASE", { cause: e })
  ).andThen((v) => {
    if (v.length == 0) {
      return err(
        new AppError("RESOURCE_NOT_FOUND", { resource: "group meta" })
      );
    }
    return ok({
      ...v[0],
      profilePhotoUrl: v[0].profilePhotoUrl
        ? completeMediaUrl(v[0].profilePhotoUrl)
        : null,
    });
  });
  if (groupTopicResult.isErr()) {
    return err(groupTopicResult.error);
  }

  const subscription = result.value.subscription;
  const group = groupTopicResult.value;

  let statusChanged = false;
  const afterAddStatus = ctx.onlineUsers.addOnlineUserToGroup(
    arg.userId,
    groupId
  );
  if (afterAddStatus.change) {
    statusChanged = true;
  }

  const online = ctx.onlineUsers.isGroupTopicOnline(groupId);
  const isSubscriberOnline = ctx.onlineUsers.isUserOnline(arg.userId);

  // 4. ⭐️ SEND THE TOPIC EVENT TO EVERY ONLINE MEMBER
  const members = await getGroupMembers(ctx, {
    groupTopicId: groupId,
  });
  if (members.isErr()) {
    return err(new AppError("UNKNOWN", { cause: members.error }));
  }
  // notify all the members
  for (const m of members.value) {
    const s = ctx.onlineUsers.get(m.id);

    if (s) {
      s.sockets.next({
        event: "notification.topic-event",
        payload: {
          event: {
            event: "join-group-through-invite-link",
            payload: {
              name: result.value.subscribed.name,
              online: isSubscriberOnline,
              profilePhotoUrl: result.value.subscribed.profilePhotoUrl,
            },
          },
          topicId: groupId,
          message:
            m.id === arg.userId
              ? `You joined the group through invite link`
              : `${result.value.subscribed.name} joined the group through invite link`,
          seqId: result.value.sequenceId,
          createdAt: result.value.createdAt,
          isFirstOfDate: result.value.isFirstOfDate,
          actor: arg.userId,
          affected: null,
        },
      });

      if (statusChanged) {
        s.sockets.next({
          event: "notification.on",
          payload: {
            topicId: groupId,
          },
        });
      }
    }
  }

  const s = ctx.onlineUsers.get(arg.userId);
  if (s) {
    s.sockets.nextExceptForSocket(
      {
        event: "notification.added-to-group",
        payload: {
          groupId,
          groupName: group.groupName,
          groupDefaultPermission: group.defaultPermissions,
          userPermission: subscription.permissions,
          profilePhotoUrl: group.profilePhotoUrl,
          ownerId: group.ownerId,
          status: online.isOnline
            ? {
                online: true,
                latestTyping: null,
              }
            : {
                online: false,
              },
        },
      },
      arg.userSocketId
    );
  }

  return ok({
    ownerId: group.ownerId,
    topicId: groupId,
    topicName: group.groupName,
    defaultPermissions: group.defaultPermissions,
    userPermissions: subscription.permissions,
    online: online.isOnline,
    profilePhotoUrl: group.profilePhotoUrl,
  });
}

import { eq, InferModel } from "drizzle-orm";
import { fromPromise, err, ok } from "neverthrow";

import { AppPgDatabase } from "~/backend/drizzle/db";
import { OnlineUsers } from "~/backend/service/common/online-users";
import {
  subscriptions,
  users,
  messages,
  topicEventLogs,
  GroupTopicId,
  UserId,
  groupTopicMeta,
} from "~/backend/drizzle/schema";
import { getPrecedingMessageDate } from "~/backend/service/topics/common/repo";
import { permission } from "~/backend/common/permissions";
import { getGroupMembers } from "~/backend/service/topics/common/repo";
import { completeMediaUrl } from "~/backend/service/topics/use-cases/send-message/media";
import { AppError } from "~/api-contract/errors/errors";
import { ServiceResult } from "~/api-contract/types";

export async function subscribeToGroupTopic(
  ctx: {
    db: AppPgDatabase;
    onlineUsers: OnlineUsers;
  },
  arg: {
    userSocketId: string;
    userId: UserId;
    groupId: GroupTopicId;
  }
): ServiceResult<"group/join_group_via_id"> {
  const defaultGroupPermission = await fromPromise(
    ctx.db
      .select({ defaultGroupPermissions: groupTopicMeta.defaultPermissions })
      .from(groupTopicMeta)
      .where(eq(groupTopicMeta.topicId, arg.groupId)),
    (e) => new AppError("DATABASE", { cause: e })
  ).andThen((v) => {
    if (v.length == 0) {
      return err(
        new AppError("RESOURCE_NOT_FOUND", { resource: "group meta" })
      );
    }
    return ok(v[0].defaultGroupPermissions);
  });

  if (defaultGroupPermission.isErr()) {
    return err(defaultGroupPermission.error);
  }

  if (!permission(defaultGroupPermission.value).canJoin()) {
    return err(new AppError("GROUP.NO_JOIN_PERMISSION", undefined));
  }

  const result = await fromPromise(
    ctx.db.transaction(async (tx) => {
      // 1. create a subscription
      const subscription = (
        await tx
          .insert(subscriptions)
          .values({
            topicId: arg.groupId,
            userId: arg.userId,
            permissions: defaultGroupPermission.value,
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
            topicId: arg.groupId,
          })
          .returning({
            id: messages.id,
            sequenceId: messages.sequenceId,
            createdAt: messages.createdAt,
          })
      )[0];

      const precedingDate = await getPrecedingMessageDate(tx, {
        topicId: arg.groupId,
        beforeSequenceId: msg.sequenceId,
      });
      if (precedingDate.isErr()) {
        throw precedingDate.error;
      }

      const log: InferModel<typeof topicEventLogs, "insert"> = {
        topicEvent: "join-group-through-id",
        topicId: arg.groupId,
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
      .where(eq(groupTopicMeta.topicId, arg.groupId)),
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
    arg.groupId
  );
  if (afterAddStatus.change) {
    statusChanged = true;
  }

  const online = ctx.onlineUsers.isGroupTopicOnline(arg.groupId);
  const isSubscriberOnline = ctx.onlineUsers.isUserOnline(arg.userId);

  // 4. ⭐️ SEND THE TOPIC EVENT TO EVERY ONLINE MEMBER
  const members = await getGroupMembers(ctx, {
    groupTopicId: arg.groupId,
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
            event: "join-group-through-id",
            payload: {
              name: result.value.subscribed.name,
              online: isSubscriberOnline,
              profilePhotoUrl: result.value.subscribed.profilePhotoUrl,
            },
          },
          topicId: arg.groupId,
          message:
            m.id === arg.userId
              ? `You joined the group`
              : `${result.value.subscribed.name} joined the group`,
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
            topicId: arg.groupId,
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
          groupId: arg.groupId,
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
    topicName: group.groupName,
    defaultPermissions: group.defaultPermissions,
    profilePhotoUrl: group.profilePhotoUrl,
    ownerId: group.ownerId,
    userPermissions: subscription.permissions,
    online: online.isOnline,
  });
}

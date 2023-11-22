import { fromPromise, err, ok } from "neverthrow";
import { OnlineUsers } from "~/backend/service/common/online-users";
import { KyselyDB, TopicEventLogs } from "~/backend/schema";
import {
  getPrecedingMessageDate,
  getGroupMembers,
} from "~/backend/service/topics/common/repo/repo";
import { permission } from "~/backend/service/common/permissions";
import { completeMediaUrl } from "~/backend/service/common/media";

import { ServiceResult } from "~/api-contract/types";
import { AppError } from "~/api-contract/errors/errors";
import { UserId, GroupTopicId } from "~/api-contract/subscription/subscription";
import { Insertable } from "kysely";

export async function joinGroupViaInviteLink(
  {
    db,
    onlineUsers,
    assetServerUrl,
  }: {
    db: KyselyDB;
    onlineUsers: OnlineUsers;
    assetServerUrl: string;
  },
  arg: {
    userId: UserId;
    userSocketId: string;
    groupInviteLinkId: string;
  }
): ServiceResult<"group/join_group_via_invite_link"> {
  const defaultGroupPermissionResult = await fromPromise(
    db
      .selectFrom("groupTopicMeta")
      .select([
        "topicId as groupId",
        "defaultPermissions as defaultGroupPermissions",
      ])
      .where("inviteLink", "=", arg.groupInviteLinkId)
      .executeTakeFirstOrThrow(),
    (e) => new AppError("DATABASE", { cause: e })
  );
  if (defaultGroupPermissionResult.isErr()) {
    return err(defaultGroupPermissionResult.error);
  }
  const groupId = defaultGroupPermissionResult.value.groupId;
  const defaultGroupPermission =
    defaultGroupPermissionResult.value.defaultGroupPermissions;

  if (!permission(defaultGroupPermission).canJoin()) {
    return err(new AppError("GROUP.NO_JOIN_PERMISSION", undefined));
  }

  const result = await fromPromise(
    db.transaction().execute(async (tx) => {
      // 1. create a subscription
      const subscription = await tx
        .insertInto("subscriptions")
        .values({
          topicId: groupId,
          userId: arg.userId,
          permissions: defaultGroupPermission,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      // 2. create a topic event log
      const _actor = await tx
        .selectFrom("users")
        .where("users.id", "=", arg.userId)
        .select(["fullname as name", "profilePhotoUrl"])
        .executeTakeFirstOrThrow();
      const actor = {
        name: _actor.name,
        profilePhotoUrl: _actor.profilePhotoUrl
          ? completeMediaUrl(assetServerUrl, _actor.profilePhotoUrl)
          : null,
      };

      const message = await tx
        .insertInto("messages")
        .values({ topicId: groupId })
        .returning(["id", "sequenceId", "createdAt"])
        .executeTakeFirstOrThrow();

      const precedingDate = await getPrecedingMessageDate(tx, {
        topicId: groupId,
        beforeSequenceId: message.sequenceId,
      });
      if (precedingDate.isErr()) {
        throw precedingDate.error;
      }

      const log: Insertable<TopicEventLogs> = {
        topicEvent: "join-group-through-invite-link",
        topicId: groupId,
        actorUserId: arg.userId,
        affectedUserId: null,
        messageId: message.id,
      };

      await tx.insertInto("topicEventLogs").values(log).execute();

      return {
        subscription,
        isFirstOfDate: precedingDate.value
          ? new Date(precedingDate.value).toDateString() !=
            new Date(message.createdAt).toDateString()
          : true,
        sequenceId: message.sequenceId,
        createdAt: new Date(message.createdAt),
        subscribed: actor,
        subscribedUserId: arg.userId,
      };
    }),
    (e) => new AppError("UNKNOWN", { cause: e })
  );
  if (result.isErr()) {
    return err(result.error);
  }

  const groupTopic = await fromPromise(
    db
      .selectFrom("groupTopicMeta")
      .where("topicId", "=", groupId)
      .select(["groupName", "defaultPermissions", "profilePhotoUrl", "ownerId"])
      .executeTakeFirstOrThrow(),
    (e) => new AppError("DATABASE", { cause: e })
  ).map((v) => ({
    ...v,
    profilePhotoUrl: v.profilePhotoUrl
      ? completeMediaUrl(assetServerUrl, v.profilePhotoUrl)
      : null,
  }));
  if (groupTopic.isErr()) {
    return err(groupTopic.error);
  }
  const subscription = result.value.subscription;
  const group = groupTopic.value;

  let statusChanged = false;
  const afterAddStatus = onlineUsers.addOnlineUserToGroup(arg.userId, groupId);
  if (afterAddStatus.change) {
    statusChanged = true;
  }

  const online = onlineUsers.isGroupTopicOnline(groupId);
  const isSubscriberOnline = onlineUsers.isUserOnline(arg.userId);

  // 4. ⭐️ SEND THE TOPIC EVENT TO EVERY ONLINE MEMBER
  const members = await getGroupMembers(db, {
    groupTopicId: groupId,
  });
  if (members.isErr()) {
    return err(new AppError("UNKNOWN", { cause: members.error }));
  }
  // notify all the members
  for (const m of members.value) {
    const s = onlineUsers.get(m.id);

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

  const s = onlineUsers.get(arg.userId);
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

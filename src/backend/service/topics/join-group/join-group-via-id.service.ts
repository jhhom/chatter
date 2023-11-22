import { fromPromise, err, ok } from "neverthrow";
import { KyselyDB, TopicEventLogs } from "~/backend/schema";
import { OnlineUsers } from "~/backend/service/common/online-users";
import { getPrecedingMessageDate } from "~/backend/service/topics/common/repo/repo";

import { completeMediaUrl } from "~/backend/service/common/media";
import { AppError } from "~/api-contract/errors/errors";
import { ServiceResult } from "~/api-contract/types";
import { getGroupMembers } from "~/backend/service/topics/common/repo/repo";
import { permission } from "~/backend/service/common/permissions";
import { UserId, GroupTopicId } from "~/api-contract/subscription/subscription";
import { Insertable } from "kysely";

export async function joinGroupViaId(
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
    userSocketId: string;
    userId: UserId;
    groupId: GroupTopicId;
  }
): ServiceResult<"group/join_group_via_id"> {
  const defaultGroupPermission = await fromPromise(
    db
      .selectFrom("groupTopicMeta")
      .where("topicId", "=", arg.groupId)
      .select("defaultPermissions")
      .executeTakeFirstOrThrow(),
    (e) => new AppError("DATABASE", { cause: e })
  );
  if (defaultGroupPermission.isErr()) {
    return err(defaultGroupPermission.error);
  }

  if (!permission(defaultGroupPermission.value.defaultPermissions).canJoin()) {
    return err(new AppError("GROUP.NO_JOIN_PERMISSION", undefined));
  }

  const result = await fromPromise(
    db.transaction().execute(async (tx) => {
      // 1. create a subscription
      const subscription = await tx
        .insertInto("subscriptions")
        .values({
          topicId: arg.groupId,
          userId: arg.userId,
          permissions: defaultGroupPermission.value.defaultPermissions,
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
        .values({ topicId: arg.groupId })
        .returning(["id", "sequenceId", "createdAt"])
        .executeTakeFirstOrThrow();

      const precedingDate = await getPrecedingMessageDate(tx, {
        topicId: arg.groupId,
        beforeSequenceId: message.sequenceId,
      });
      if (precedingDate.isErr()) {
        throw precedingDate.error;
      }

      const log: Insertable<TopicEventLogs> = {
        topicEvent: "join-group-through-id",
        topicId: arg.groupId,
        actorUserId: arg.userId,
        affectedUserId: null,
        messageId: message.id,
      };

      await tx.insertInto("topicEventLogs").values(log).execute();

      return {
        subscription,
        isFirstOfDate: precedingDate.value
          ? new Date(precedingDate.value).toDateString() !=
            message.createdAt.toDateString()
          : true,
        sequenceId: message.sequenceId,
        createdAt: message.createdAt,
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
    db
      .selectFrom("groupTopicMeta")
      .select(["groupName", "defaultPermissions", "profilePhotoUrl", "ownerId"])
      .where("topicId", "=", arg.groupId)
      .executeTakeFirstOrThrow(),
    (e) => new AppError("DATABASE", { cause: e })
  ).map((v) => ({
    ...v,
    profilePhotoUrl: v.profilePhotoUrl
      ? completeMediaUrl(assetServerUrl, v.profilePhotoUrl)
      : null,
  }));
  if (groupTopicResult.isErr()) {
    return err(groupTopicResult.error);
  }

  const subscription = result.value.subscription;
  const group = groupTopicResult.value;

  let statusChanged = false;
  const afterAddStatus = onlineUsers.addOnlineUserToGroup(
    arg.userId,
    arg.groupId
  );
  if (afterAddStatus.change) {
    statusChanged = true;
  }

  const online = onlineUsers.isGroupTopicOnline(arg.groupId);
  const isSubscriberOnline = onlineUsers.isUserOnline(arg.userId);

  // 4. ⭐️ SEND THE TOPIC EVENT TO EVERY ONLINE MEMBER
  const members = await getGroupMembers(db, {
    groupTopicId: arg.groupId,
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

  const s = onlineUsers.get(arg.userId);
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

import { KyselyDB } from "~/backend/schema";
import { GroupTopicId, UserId } from "~/api-contract/subscription/subscription";
import { AppError } from "~/api-contract/errors/errors";
import { ServiceResult } from "~/api-contract/types";
import { fromPromise, ok, err } from "neverthrow";
import { OnlineUsers } from "~/backend/service/common/online-users";
import { isPermissionStringValid } from "~/backend/service/topics/permissions/permissions";
import { permission } from "~/backend/service/common/permissions";

export async function getMemberPermissionInGroup(
  db: KyselyDB,
  arg: {
    groupTopicId: GroupTopicId;
    memberUserId: UserId;
  }
): ServiceResult<"permissions/get_group_member_permission"> {
  return fromPromise(
    db
      .selectFrom("subscriptions")
      .select("permissions")
      .where("topicId", "=", arg.groupTopicId)
      .where("userId", "=", arg.memberUserId)
      .executeTakeFirstOrThrow(),
    (e) => new AppError("DATABASE", { cause: e })
  ).map((v) => v.permissions);
}

export async function updateGroupMemberPermission(
  ctx: { db: KyselyDB; onlineUsers: OnlineUsers },
  arg: {
    newPermission: string;
    groupTopicId: GroupTopicId;
    memberUserId: UserId;
  }
): ServiceResult<"permissions/update_group_member_permission"> {
  if (!isPermissionStringValid(arg.newPermission)) {
    return err(
      new AppError("UNKNOWN", { cause: new Error("Permission is invalid") })
    );
  }

  const r = await fromPromise(
    ctx.db
      .updateTable("subscriptions")
      .set({ permissions: arg.newPermission })
      .where("subscriptions.topicId", "=", arg.groupTopicId)
      .where("subscriptions.userId", "=", arg.memberUserId)
      .returning("permissions as updatedPermission")
      .executeTakeFirstOrThrow(),
    (e) => new AppError("DATABASE", { cause: e })
  );
  if (r.isErr()) {
    return err(r.error);
  }

  const user = ctx.onlineUsers.get(arg.memberUserId);
  if (user) {
    user.sockets.next({
      event: "notification.grp-topic-permission-update",
      payload: {
        topicId: arg.groupTopicId,
        permissionUpdated: "self",
        updatedPermission: arg.newPermission,
      },
    });
  }

  return ok(r.value.updatedPermission);
}

export async function updateGroupDefaultPermission(
  ctx: { db: KyselyDB; onlineUsers: OnlineUsers },
  arg: {
    newDefaultPermission: string;
    groupTopicId: GroupTopicId;
    requesterUserId: UserId;
  }
): ServiceResult<"permissions/update_group_default_permission"> {
  if (!isPermissionStringValid(arg.newDefaultPermission)) {
    return err(
      new AppError("UNKNOWN", { cause: new Error("Permission is invalid") })
    );
  }

  const r = await fromPromise(
    ctx.db
      .updateTable("groupTopicMeta")
      .set({
        defaultPermissions: arg.newDefaultPermission,
      })
      .where("groupTopicMeta.topicId", "=", arg.groupTopicId)
      .returning("defaultPermissions")
      .executeTakeFirstOrThrow(),
    (e) => new AppError("DATABASE", { cause: e })
  );
  if (r.isErr()) {
    return err(r.error);
  }

  const groupSubscribers = await fromPromise(
    ctx.db
      .selectFrom("subscriptions")
      .select("userId")
      .where("topicId", "=", arg.groupTopicId)
      .execute(),
    (e) => new AppError("DATABASE", { cause: e })
  );
  if (groupSubscribers.isErr()) {
    return err(groupSubscribers.error);
  }

  for (const s of groupSubscribers.value) {
    const conn = ctx.onlineUsers.get(s.userId);
    if (conn) {
      conn.sockets.next({
        event: "notification.grp-topic-permission-update",
        payload: {
          topicId: arg.groupTopicId,
          permissionUpdated: "default",
          updatedPermission: arg.newDefaultPermission,
        },
      });
    }
  }

  return r;
}

export async function updatePeerPermission(
  { db, onlineUsers }: { db: KyselyDB; onlineUsers: OnlineUsers },
  arg: {
    newPermission: string;
    /** the user making the request */
    requesterUserId: UserId;
    /** peer id of which the permission is requested of */
    peerId: UserId;
  }
): ServiceResult<"permissions/update_peer_permission"> {
  if (!isPermissionStringValid(arg.newPermission)) {
    return err(
      new AppError("UNKNOWN", { cause: new Error("Permission is invalid") })
    );
  }

  const r = await fromPromise(
    db
      .selectFrom("users")
      .innerJoin("subscriptions as peer", (join) =>
        join.on("peer.userId", "=", arg.peerId)
      )
      .innerJoin("subscriptions as requester", (join) =>
        join.on("requester.userId", "=", arg.requesterUserId)
      )
      .innerJoin("topics", (join) =>
        join
          .onRef("topics.id", "=", "peer.topicId")
          .onRef("topics.id", "=", "requester.topicId")
      )
      .select("peer.id as peerSubscriptionId")
      .where("peer.userId", "=", arg.peerId)
      .where("requester.userId", "=", arg.requesterUserId)
      .where("topics.topicType", "=", "p2p")
      .executeTakeFirstOrThrow(),
    (e) => new AppError("DATABASE", { cause: e })
  );
  if (r.isErr()) {
    return err(r.error);
  }

  const updatedPermissionResult = await fromPromise(
    db
      .updateTable("subscriptions")
      .set({ permissions: arg.newPermission })
      .where("subscriptions.id", "=", r.value.peerSubscriptionId)
      .returning("permissions")
      .executeTakeFirstOrThrow(),
    (e) => new AppError("DATABASE", { cause: e })
  );
  if (updatedPermissionResult.isErr()) {
    return err(updatedPermissionResult.error);
  }
  const updatedPermission = updatedPermissionResult.value.permissions;

  // send notifications to subscriber
  {
    const s = onlineUsers.get(arg.peerId);
    if (s) {
      s.sockets.next({
        event: "notification.p2p-topic-permission-update",
        payload: {
          topicId: arg.requesterUserId,
          updatedPermission: updatedPermission,
          permissionUpdatedOn: "self",
          status: permission(updatedPermission).canGetNotifiedOfPresence()
            ? {
                online: onlineUsers.isUserOnline(arg.requesterUserId),
              }
            : undefined,
        },
      });
    }
  }

  {
    const s = onlineUsers.get(arg.requesterUserId);
    if (s) {
      s.sockets.next({
        event: "notification.p2p-topic-permission-update",
        payload: {
          topicId: arg.peerId,
          updatedPermission: updatedPermission,
          permissionUpdatedOn: "peer",
        },
      });
    }
  }

  return ok({ permissions: updatedPermission });
}

export async function updateUserDefaultPermission(
  db: KyselyDB,
  arg: {
    userId: UserId;
    newPermission: string;
  }
): ServiceResult<"permissions/update_user_default_permission"> {
  if (!isPermissionStringValid(arg.newPermission)) {
    return err(
      new AppError("UNKNOWN", { cause: new Error("Permission is invalid") })
    );
  }

  const permissionUpdateResult = await fromPromise(
    db
      .updateTable("users")
      .set({
        defaultPermissions: arg.newPermission,
      })
      .where("users.id", "=", arg.userId)
      .returning("defaultPermissions")
      .executeTakeFirstOrThrow(),
    (e) => new AppError("DATABASE", { cause: e })
  );
  if (permissionUpdateResult.isErr()) {
    return err(permissionUpdateResult.error);
  }

  return ok({
    defaultPermission: permissionUpdateResult.value.defaultPermissions,
  });
}

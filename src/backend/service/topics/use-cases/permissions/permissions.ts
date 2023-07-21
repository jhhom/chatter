import {
  UserId,
  users,
  subscriptions,
  topics,
  GroupTopicId,
  groupTopicMeta,
} from "~/backend/drizzle/schema";
import { PgTransaction, alias } from "drizzle-orm/pg-core";
import { fromPromise, ok, err, okAsync, errAsync } from "neverthrow";
import { eq, not, and } from "drizzle-orm";
import { OnlineUsers } from "~/backend/service/common/online-users";
import { getPermissionInP2PTopic } from "~/backend/service/topics/common/repo";
import { AppPgDatabase, AppPgTransaction } from "~/backend/drizzle/db";
import { permission } from "~/backend/common/permissions";
import { ServiceResult } from "~/api-contract/types";
import { AppError } from "~/api-contract/errors/errors";

export async function updateUserDefaultPermission(
  db: AppPgDatabase,
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
      .update(users)
      .set({
        defaultPermissions: arg.newPermission,
      })
      .where(eq(users.id, arg.userId))
      .returning(),
    (e) => new AppError("DATABASE", { cause: e })
  );
  if (permissionUpdateResult.isErr()) {
    return err(permissionUpdateResult.error);
  }

  return ok({
    defaultPermission: permissionUpdateResult.value[0].defaultPermissions,
  });
}

export function getUserDefaultPermission(
  db: AppPgDatabase | AppPgTransaction,
  arg: {
    userId: UserId;
  }
) {
  return fromPromise(
    db
      .select({ defaultPermissions: users.defaultPermissions })
      .from(users)
      .where(eq(users.id, arg.userId)),
    (e) =>
      ({
        type: "database error",
        cause: e,
      } as const)
  ).map((v) => v[0]);
}

export function getPeerPermission(
  db: AppPgDatabase,
  arg: {
    /** the user making the request */
    requesterUserId: UserId;
    /** peer id of which the permission is requested of */
    peerId: UserId;
  }
) {
  return getPermissionInP2PTopic(db, {
    peer1: arg.requesterUserId,
    peer2: arg.peerId,
    permissionRequested: "peer2",
  });
}

export async function updateGroupMemberPermission(
  ctx: { db: AppPgDatabase; onlineUsers: OnlineUsers },
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
      .update(subscriptions)
      .set({
        permissions: arg.newPermission,
      })
      .where(
        and(
          eq(subscriptions.topicId, arg.groupTopicId),
          eq(subscriptions.userId, arg.memberUserId)
        )
      )
      .returning({ updatedPermission: subscriptions.permissions }),
    (e) => new AppError("DATABASE", { cause: e })
  );

  if (r.isErr()) {
    return err(r.error);
  }
  if (r.value.length == 0) {
    return err(
      new AppError("RESOURCE_NOT_FOUND", { resource: "updated permission" })
    );
  }
  const updatedPermission = r.value[0].updatedPermission;

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

  return ok(updatedPermission);
}

export async function getMemberPermissionInGroup(
  ctx: { db: AppPgDatabase },
  arg: {
    groupTopicId: GroupTopicId;
    memberUserId: UserId;
  }
): ServiceResult<"permissions/get_group_member_permission"> {
  const r = await fromPromise(
    ctx.db
      .select({ permissions: subscriptions.permissions })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.topicId, arg.groupTopicId),
          eq(subscriptions.userId, arg.memberUserId)
        )
      ),
    (e) => new AppError("DATABASE", { cause: e })
  );
  if (r.isErr()) {
    return err(r.error);
  }
  if (r.value.length == 0) {
    return err(
      new AppError("RESOURCE_NOT_FOUND", { resource: "user subscription" })
    );
  }
  return ok(r.value[0].permissions);
}

export async function updateGroupDefaultPermission(
  ctx: { db: AppPgDatabase; onlineUsers: OnlineUsers },
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
      .update(groupTopicMeta)
      .set({
        defaultPermissions: arg.newDefaultPermission,
      })
      .where(eq(groupTopicMeta.topicId, arg.groupTopicId))
      .returning({
        defaultPermissions: groupTopicMeta.defaultPermissions,
      }),
    (e) => new AppError("DATABASE", { cause: e })
  ).andThen((v) => {
    if (v.length == 0) {
      return err(
        new AppError("RESOURCE_NOT_FOUND", { resource: "group meta" })
      );
    }
    return ok(v[0]);
  });

  if (r.isOk()) {
    // get group topic subscribers
    const groupTopicSubscribers = await fromPromise(
      ctx.db
        .select({ userId: subscriptions.userId })
        .from(subscriptions)
        .where(eq(subscriptions.topicId, arg.groupTopicId)),
      (e) => new AppError("DATABASE", { cause: e })
    );
    if (groupTopicSubscribers.isErr()) {
      return err(groupTopicSubscribers.error);
    }

    for (const s of groupTopicSubscribers.value) {
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
  }

  return r;
}

export async function updatePeerPermission(
  db: AppPgDatabase,
  onlineUsers: OnlineUsers,
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

  const peer = alias(subscriptions, "peer");
  const requester = alias(subscriptions, "requester");

  const r = await fromPromise(
    db
      .select({ peerSubscriptionId: peer.id })
      .from(users)
      .where(
        and(
          eq(peer.userId, arg.peerId),
          eq(requester.userId, arg.requesterUserId),
          eq(topics.topicType, "p2p")
        )
      )
      .innerJoin(peer, eq(peer.userId, arg.peerId))
      .innerJoin(requester, eq(requester.userId, arg.requesterUserId))
      .innerJoin(
        topics,
        and(eq(topics.id, peer.topicId), eq(topics.id, requester.topicId))
      ),
    (e) => new AppError("DATABASE", { cause: e })
  ).andThen((v) => {
    if (v.length == 0) {
      return errAsync(
        new AppError("RESOURCE_NOT_FOUND", { resource: "topic" })
      );
    }
    return okAsync(v[0]);
  });
  if (r.isErr()) {
    return err(r.error);
  }

  const r2 = await fromPromise(
    db
      .update(subscriptions)
      .set({ permissions: arg.newPermission })
      .where(eq(subscriptions.id, r.value.peerSubscriptionId))
      .returning({ permissions: subscriptions.permissions }),
    (e) => new AppError("DATABASE", { cause: e })
  ).map((v) => v[0]);

  // send notifications to subscriber
  {
    const s = onlineUsers.get(arg.peerId);
    if (s) {
      s.sockets.next({
        event: "notification.p2p-topic-permission-update",
        payload: {
          topicId: arg.requesterUserId,
          updatedPermission: arg.newPermission,
          permissionUpdatedOn: "self",
          status: permission(arg.newPermission).canGetNotifiedOfPresence()
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
          updatedPermission: arg.newPermission,
          permissionUpdatedOn: "peer",
        },
      });
    }
  }

  return r2;
}

export function isPermissionStringValid(input: string): boolean {
  const validCharacters = ["J", "R", "W", "P", "S", "D", "A"];

  // Check if the string contains any invalid characters
  for (const char of input) {
    if (!validCharacters.includes(char)) {
      return false;
    }
  }

  // Check if the string contains repeating characters
  const hasRepeatingCharacters = new Set(input).size != input.length;

  return !hasRepeatingCharacters;
}

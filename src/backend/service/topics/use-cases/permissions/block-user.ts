import { err, errAsync, ok, okAsync, fromPromise } from "neverthrow";
import { alias } from "drizzle-orm/pg-core";
import { and, eq } from "drizzle-orm";

import { permission } from "~/backend/common/permissions";
import { AppPgDatabase } from "~/backend/drizzle/db";
import { OnlineUsers } from "~/backend/service/common/online-users";
import { UserId } from "~/backend/drizzle/schema";
import { users, topics, subscriptions } from "~/backend/drizzle/schema";
import { ServiceResult } from "~/api-contract/types";
import { AppError } from "~/api-contract/errors/errors";

export async function blockPeer(
  db: AppPgDatabase,
  onlineUsers: OnlineUsers,
  arg: {
    /** the user making the request */
    requesterUserId: UserId;
    /** peer id of which the permission is requested of */
    peerId: UserId;
  }
): ServiceResult<"permissions/block_peer"> {
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
        new AppError("RESOURCE_NOT_FOUND", { resource: "peer topic" })
      );
    }
    return okAsync(v[0]);
  });
  if (r.isErr()) {
    return err(r.error);
  }

  const peerPermissionResult = await fromPromise(
    db
      .select({ permissions: subscriptions.permissions })
      .from(subscriptions)
      .where(eq(subscriptions.id, r.value.peerSubscriptionId)),
    (e) => new AppError("DATABASE", { cause: e })
  ).map((v) => v[0]);
  if (peerPermissionResult.isErr()) {
    return err(peerPermissionResult.error);
  }

  const newPermission = peerPermissionResult.value.permissions.replaceAll(
    "J",
    ""
  );

  const updatedPeerPermissionResult = await fromPromise(
    db
      .update(subscriptions)
      .set({ permissions: newPermission })
      .where(eq(subscriptions.id, r.value.peerSubscriptionId))
      .returning({ permissions: subscriptions.permissions }),
    (e) => new AppError("DATABASE", { cause: e })
  ).map((v) => v[0]);
  if (updatedPeerPermissionResult.isErr()) {
    return err(updatedPeerPermissionResult.error);
  }

  const updatedPermission = updatedPeerPermissionResult.value.permissions;

  // send notifications to subscriber
  {
    const s = onlineUsers.get(arg.peerId);
    if (s) {
      s.sockets.next({
        event: "notification.p2p-topic-permission-update",
        payload: {
          topicId: arg.requesterUserId,
          updatedPermission,
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
          updatedPermission,
          permissionUpdatedOn: "peer",
        },
      });
    }
  }

  return updatedPeerPermissionResult;
}

import { err, errAsync, okAsync, fromPromise } from "neverthrow";

import { KyselyDB } from "~/backend/schema";
import { OnlineUsers } from "~/backend/service/common/online-users";
import { UserId } from "~/api-contract/subscription/subscription";
import { ServiceResult } from "~/api-contract/types";
import { AppError } from "~/api-contract/errors/errors";
import { permission } from "~/backend/service/common/permissions";

export async function blockPeer(
  {
    db,
    onlineUsers,
  }: {
    db: KyselyDB;
    onlineUsers: OnlineUsers;
  },
  arg: {
    /** the user making the request */
    requesterUserId: UserId;
    /** peer id of which the permission is requested of */
    peerId: UserId;
  }
): ServiceResult<"permissions/block_peer"> {
  const peerSubscriptionId = await fromPromise(
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
  if (peerSubscriptionId.isErr()) {
    return err(peerSubscriptionId.error);
  }

  const peerPermissionResult = await fromPromise(
    db
      .selectFrom("subscriptions")
      .select("permissions")
      .where("id", "=", peerSubscriptionId.value.peerSubscriptionId)
      .executeTakeFirstOrThrow(),
    (e) => new AppError("DATABASE", { cause: e })
  );
  if (peerPermissionResult.isErr()) {
    return err(peerPermissionResult.error);
  }

  const newPermission = peerPermissionResult.value.permissions.replaceAll(
    "J",
    ""
  );

  const updatePeerPermissionResult = await fromPromise(
    db
      .updateTable("subscriptions")
      .set({ permissions: newPermission })
      .where("id", "=", peerSubscriptionId.value.peerSubscriptionId)
      .returning("permissions")
      .executeTakeFirstOrThrow(),
    (e) => new AppError("DATABASE", { cause: e })
  );
  if (updatePeerPermissionResult.isErr()) {
    return err(updatePeerPermissionResult.error);
  }

  const updatedPermission = updatePeerPermissionResult.value.permissions;

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

  return updatePeerPermissionResult;
}

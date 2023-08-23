import { permission } from "~/backend/service/common/permissions";

export type GroupConversationDisplayMode = typeof groupConversationDisplayMode;

export const groupConversationDisplayMode = {
  NORMAL: "normal",
  NEEDS_UNBLOCKING: "needs unblocking",
  BLOCKED_BY_PEER: "blocked by peer",
  READ_DISABLED: "read disabled",
  WRITE_DISABLED: "write disabled",
  REMOVED_FROM_GROUP: "removed from group",
} as const;

export const userGroupConversationDisplayMode = (
  userPermissions: string
): {
  type: Exclude<
    GroupConversationDisplayMode[keyof GroupConversationDisplayMode],
    GroupConversationDisplayMode["NEEDS_UNBLOCKING"]
  >;
} => {
  const user = permission(userPermissions);

  if (!user.canRead()) {
    return { type: "read disabled" };
  } else if (!user.canWrite()) {
    return { type: "write disabled" };
  } else {
    return { type: "normal" };
  }
};

export const peerConversationDisplayMode = {
  NORMAL: "normal",
  NEEDS_UNBLOCKING: "needs unblocking",
  BLOCKED_BY_PEER: "blocked by peer",
  READ_DISABLED: "read disabled",
  WRITE_DISABLED: "write disabled",
  REMOVED_FROM_GROUP: "removed from group",
} as const;

export type PeerConversationDisplayMode = typeof peerConversationDisplayMode;

export const userPeerConversationDisplayMode = (
  userPermissions: string,
  peerPermissions: string,
  isNewContact: boolean,
  onUnblock: () => void
):
  | {
      type: Exclude<
        PeerConversationDisplayMode[keyof PeerConversationDisplayMode],
        PeerConversationDisplayMode["NEEDS_UNBLOCKING"]
      >;
    }
  | {
      type: PeerConversationDisplayMode["NEEDS_UNBLOCKING"];
      onUnblock: () => void;
    } => {
  const peer = permission(peerPermissions);
  const user = permission(userPermissions);

  if (isNewContact) {
    if (!user.canJoin()) {
      return { type: "blocked by peer" };
    }
    if (!user.canRead()) {
      return { type: "read disabled" };
    }
    if (!user.canWrite()) {
      return { type: "write disabled" };
    }
    return { type: "normal" };
  }

  if (!user.canJoin()) {
    return { type: "blocked by peer" };
  }
  if (peer.canJoin()) {
    if (user.canRead() && user.canWrite()) {
      return { type: "normal" };
    } else if (user.canWrite()) {
      return { type: "read disabled" };
    } else {
      return { type: "write disabled" };
    }
  } else {
    return {
      type: "needs unblocking",
      onUnblock,
    };
  }
};

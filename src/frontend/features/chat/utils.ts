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

import { z } from "zod";
import { zGroupId, zUserId } from "~/api-contract/common/common";

export const contract = {
  "permissions/update_user_default_permission": {
    input: z.object({
      newPermission: z.string(),
    }),
    output: z.object({
      defaultPermission: z.string(),
    }),
  },
  "permissions/update_peer_permission": {
    input: z.object({
      peerId: zUserId,
      newPermission: z.string(),
    }),
    output: z.object({
      permissions: z.string(),
    }),
  },
  "permissions/block_peer": {
    input: z.object({
      peerId: zUserId,
    }),
    output: z.unknown(),
  },
  "permissions/update_group_default_permission": {
    input: z.object({
      newDefaultPermission: z.string(),
      groupTopicId: zGroupId,
    }),
    output: z.object({
      defaultPermissions: z.string(),
    }),
  },
  "permissions/update_group_member_permission": {
    input: z.object({
      newPermission: z.string(),
      groupTopicId: zGroupId,
      memberUserId: zUserId,
    }),
    output: z.string(),
  },
  "permissions/get_group_member_permission": {
    input: z.object({
      groupTopicId: zGroupId,
      memberUserId: zUserId,
    }),
    output: z.string(),
  },
};

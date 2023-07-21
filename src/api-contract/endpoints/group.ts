import { z } from "zod";
import { zGroupId, zUserId } from "~/api-contract/common/common";

export const contract = {
  "group/add_members": {
    input: z.object({
      groupTopicId: zGroupId,
      membersToAdd: z.array(zUserId),
    }),
    output: z.array(
      z.object({
        online: z.boolean(),
        id: zUserId,
        username: z.string(),
        fullname: z.string(),
        profilePhotoUrl: z.string().nullable(),
      })
    ),
  },
  "group/find_new_members": {
    input: z.object({
      groupTopicId: zGroupId,
      searchQueryUsername: z.string().optional(),
    }),
    output: z.array(
      z.object({
        profilePhotoUrl: z.string().nullable(),
        userId: zUserId,
        userFullname: z.string(),
      })
    ),
  },
  "group/create_group": {
    input: z.object({
      groupName: z.string().min(1),
      photoBase64: z.string().nullable(),
    }),
    output: z.object({
      topicId: zGroupId,
      groupName: z.string(),
      profilePhotoUrl: z.string().nullable(),
    }),
  },
  "group/preview_info": {
    input: z.object({
      groupInviteLinkId: z.string(),
    }),
    output: z.object({
      groupId: zGroupId,
      groupName: z.string(),
      numberOfParticipants: z.number().int(),
      profilePhotoUrl: z.string().nullable(),
    }),
  },
  "group/members": {
    input: z.object({
      groupTopicId: zGroupId,
    }),
    output: z.array(
      z.object({
        online: z.boolean(),
        id: zUserId,
        username: z.string(),
        fullname: z.string(),
        profilePhotoUrl: z.string().nullable(),
      })
    ),
  },
  "group/invite_link": {
    input: z.object({
      groupTopicId: zGroupId,
    }),
    output: z.object({
      inviteLink: z.string(),
    }),
  },
  "group/remove_member": {
    input: z.object({
      groupTopicId: zGroupId,
      memberId: zUserId,
    }),
    output: z.unknown(),
  },
  "group/leave_group": {
    input: z.object({
      groupTopicId: zGroupId,
    }),
    output: z.unknown(),
  },
  "group/join_group_via_id": {
    input: z.object({
      groupTopicId: zGroupId,
    }),
    output: z.object({
      topicName: z.string(),
      defaultPermissions: z.string(),
      profilePhotoUrl: z.string().nullable(),
      ownerId: zUserId,
      userPermissions: z.string(),
      online: z.boolean(),
    }),
  },
  "group/join_group_via_invite_link": {
    input: z.object({
      inviteLinkId: z.string().min(1),
    }),
    output: z.object({
      topicId: zGroupId,
      topicName: z.string(),
      defaultPermissions: z.string(),
      profilePhotoUrl: z.string().nullable(),
      ownerId: zUserId,
      userPermissions: z.string(),
      online: z.boolean(),
    }),
  },
  "group/am_i_group_member_of": {
    input: z.object({
      groupTopicId: zGroupId,
    }),
    output: z.boolean(),
  },
  // #endregion
};

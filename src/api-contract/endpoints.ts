import { z } from "zod";

import { contract as groupApiContract } from "./endpoints/group";
import {
  contract as topicApiContract,
  lastMessageOfTopicSchema,
} from "./endpoints/topic/topic";
import { contract as permissionApiContract } from "./endpoints/permission";
import { zUserId, zGroupId, zP2PTopicId } from "~/api-contract/common/common";

const getUserTopicsGeneral = z.object({
  topicName: z.string(),
  touchedAt: z.date().nullable(),
  profilePhotoUrl: z.string().nullable(),
  lastMessage: lastMessageOfTopicSchema.nullable(),
});

export type Contract = typeof contract;

export const contract = {
  // #region AUTH APIs
  "auth/login_with_token": {
    input: z.object({
      jwtToken: z.string().min(1),
    }),
    output: z.object({
      id: zUserId,
      username: z.string(),
      email: z.string(),
      fullname: z.string(),
      defaultPermissions: z.string(),
      profilePhotoUrl: z.string().nullable(),
      subscribedGroupTopicIds: z.array(zGroupId),
    }),
  },
  "auth/login": {
    input: z.object({
      username: z.string().min(1),
      password: z.string().min(1),
    }),
    output: z.object({
      userId: zUserId,
      token: z.string(),
      username: z.string(),
      email: z.string(),
      fullname: z.string(),
      defaultPermissions: z.string(),
      profilePhotoUrl: z.string().nullable(),
    }),
  },
  "auth/logout": {
    output: z.unknown(),
  },
  // #endregion

  "users/create_user": {
    input: z.object({
      username: z.string().min(1),
      fullname: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(3),
      photoBase64: z.string().nullable(),
    }),
    output: z.object({
      username: z.string(),
      email: z.string(),
      createdAt: z.date(),
      profilePhotoUrl: z.string().nullable(),
    }),
  },
  "users/find_users_to_add_as_contact": {
    input: z.object({
      email: z.string(),
    }),
    output: z.array(
      z.object({
        profilePhotoUrl: z.string().nullable(),
        fullname: z.string(),
        email: z.string(),
        id: zUserId,
        defaultPermissions: z.string(),
      })
    ),
  },
  "users/topics": {
    output: z.array(
      z.discriminatedUnion("type", [
        getUserTopicsGeneral.extend({
          type: z.literal("grp"),
          topicId: zGroupId,
          defaultPermissions: z.string(),
          userPermissions: z.string(),
          ownerId: zUserId,
        }),
        getUserTopicsGeneral.extend({
          type: z.literal("p2p"),
          p2pTopicId: zP2PTopicId,
          topicId: zUserId,
          peerPermissions: z.string(),
          userPermissions: z.string(),
          lastOnline: z.date().nullable(),
        }),
        getUserTopicsGeneral.extend({
          type: z.literal("past-grp"),
          topicId: zGroupId,
          memberListSnapshot: z.array(
            z.object({
              userId: zUserId,
              name: z.string(),
              profilePhotoUrl: z.string().nullable(),
            })
          ),
        }),
      ])
    ),
  },
  "users/contact_status": {
    output: z.object({
      groupContactStatus: z.array(
        z.object({
          topicId: zGroupId,
          online: z.boolean(),
          typing: z.boolean(),
        })
      ),
      p2pContactStatus: z.array(
        z.object({
          topicId: zUserId,
          online: z.boolean(),
          typing: z.boolean(),
          lastOnline: z.date().nullable(),
        })
      ),
    }),
  },

  ...groupApiContract,
  ...topicApiContract,
  ...permissionApiContract,
};

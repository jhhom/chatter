import { ok, err } from "neverthrow";

import { KyselyDB } from "~/backend/schema";
import { OnlineUsers } from "~/backend/service/common/online-users";
import { UserId } from "~/api-contract/subscription/subscription";

import { getPermissionInP2PTopic } from "~/backend/service/auth/common/repo";
import { permission } from "~/backend/service/common/permissions";

import { getUserContact } from "~/backend/service/topics/get-contact-status/get-contact-status.repository";
import { AppError } from "~/api-contract/errors/errors";
import { ServiceResult } from "~/api-contract/types";

export async function getContactStatus(
  ctx: { db: KyselyDB; onlineUsers: OnlineUsers },
  input: {
    userId: UserId;
  }
): ServiceResult<"users/contact_status"> {
  // The flow of getting the contact status for a user
  // ---------------------------------------------------------
  // 1. Get the list of contacts of the user
  // 2. For every group topic, check if group topic is online
  // 3. For every P2P topic, check if P2P topic is online
  //    3.1 For P2P topic, check if user has the permission to receive the presence updates of the user
  //    3.2 If not, it will be set as offline (even if the contact is online)

  // 1. ⭐️ GET THE LIST OF CONTACTS OF THE USER
  const result = await getUserContact(ctx.db, input.userId);
  if (result.isErr()) {
    return err(new AppError("UNKNOWN", { cause: result.error }));
  }
  const { groupTopics, p2pTopics } = result.value;

  // 2. ⭐️ FOR EVERY GROUP TOPIC, CHECK IF GROUP TOPIC IS ONLINE
  const groupContactStatus = groupTopics.map((t) => {
    const status = ctx.onlineUsers.isGroupTopicOnline(t.topicId);
    if (status.isOnline) {
      return {
        topicId: t.topicId,
        online: true,
        typing: false,
      };
    } else {
      return {
        topicId: t.topicId,
        online: false,
        typing: false,
      };
    }
  });

  // 3. ⭐️ FOR EVERY P2P TOPIC, CHECK IF P2P TOPIC IS ONLINE
  const p2pContactStatus = await Promise.all(
    p2pTopics.map(async (t) => {
      const status = ctx.onlineUsers.isP2PUserOnline(input.userId, t.topicId);

      // check permission to receive notification
      // 3.1 ⭐️ FOR P2P TOPIC, CHECK IF USER HAS THE PERMISSION TO RECEIVE THE PRESENCE UPDATES OF THE USER
      {
        const r = await getPermissionInP2PTopic(ctx.db, {
          peer1: input.userId,
          peer2: t.topicId,
          permissionRequested: "peer1",
        });
        if (r.isErr()) {
          if (r.error.type == "No topic found") {
            return {
              topicId: t.topicId,
              online: false as const,
              lastOnline: null,
              typing: false,
            };
          } else {
            throw r.error;
          }
        }

        // 3.2 ⭐️ IF NOT, IT WILL BE SET AS OFFLINE (EVEN IF THE CONTACT IS ONLINE)
        if (!permission(r.value.permissions).canGetNotifiedOfPresence()) {
          return {
            topicId: t.topicId,
            online: false as const,
            lastOnline: null,
            typing: false,
          };
        }
      }

      if (status.isOnline) {
        return {
          topicId: t.topicId,
          online: true as const,
          typing: status.typing,
          lastOnline: null,
        };
      } else {
        return {
          topicId: t.topicId,
          online: false as const,
          lastOnline: t.lastOnline,
          typing: false,
        };
      }
    })
  );

  return ok({ groupContactStatus, p2pContactStatus });
}

import { KyselyDB } from "~/backend/schema";
import { OnlineUsers } from "~/backend/service/common/online-users";
import type {
  UserId,
  GroupTopicId,
} from "~/api-contract/subscription/subscription";
import { GroupOnlineStatusChangeNotificationListItem } from "~/backend/service/common/online-users";
import { getUserTopics } from "~/backend/service/auth/common/notify-status/notify-status.repo";
import { getPermissionInP2PTopic } from "~/backend/service/auth/common/repo";
import { permission } from "~/backend/service/common/permissions";
import { ok, err } from "neverthrow";

export async function notifyStatus(
  ctx: { db: KyselyDB; onlineUsers: OnlineUsers },
  arg: {
    userId: UserId;
    online: boolean;
    groupStatusChangeNotificationList: GroupOnlineStatusChangeNotificationListItem[];
    groupsWithChangesOnOnlineMemberList: GroupTopicId[];
  }
) {
  const topics = await getUserTopics(ctx.db, arg.userId);
  if (topics.isErr()) {
    return err(topics.error);
  }

  const { p2pTopics, groupTopics } = topics.value;

  // 1. notify p2p topic
  for (const [contact, user] of ctx.onlineUsers.entries()) {
    if (
      user &&
      user.sockets &&
      p2pTopics.find((v) => v === contact) !== undefined
    ) {
      // check permission to receive notification
      {
        const r = await getPermissionInP2PTopic(ctx.db, {
          peer1: contact,
          peer2: arg.userId,
          permissionRequested: "peer1",
        });
        if (r.isErr()) {
          if (r.error.type == "No topic found") {
            return ok({});
          } else {
            throw r.error;
          }
        }

        if (!permission(r.value.permissions).canGetNotifiedOfPresence()) {
          continue;
        }
      }

      if (arg.online) {
        user.sockets.next({
          event: "notification.on",
          payload: {
            topicId: arg.userId,
          },
        });
      } else {
        user.sockets.next({
          event: "notification.off",
          payload: {
            topicId: arg.userId,
            lastOnline: new Date(),
          },
        });
      }
    }
  }

  // 2. notify group topics (general)
  for (const { userId, topicId } of arg.groupStatusChangeNotificationList) {
    const user = ctx.onlineUsers.get(userId);
    if (user == undefined) {
      continue;
    }
    if (arg.online) {
      user.sockets.next({
        event: "notification.on",
        payload: {
          topicId,
        },
      });
    } else {
      user.sockets.next({
        event: "notification.off",
        payload: {
          topicId,
          lastOnline: new Date(),
        },
      });
    }
  }

  // 3. notify detailed online member list change for group topics (for users who are subscribed)
  for (const topicId of arg.groupsWithChangesOnOnlineMemberList) {
    const subscribers =
      ctx.onlineUsers.onlineMemberListChangeNotificationSubscribers(topicId);
    for (const sub of subscribers) {
      const usr = ctx.onlineUsers.get(sub);
      if (!usr) {
        continue;
      }
      usr.sockets.next({
        event: "group-chat-notification.online-members",
        payload: {
          topicId,
          onlineMembers: ctx.onlineUsers.onlineMembersOfGroup(topicId),
        },
      });
    }
  }

  return ok({});
}

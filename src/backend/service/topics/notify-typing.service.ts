import { ok, err } from "neverthrow";

import { KyselyDB } from "~/backend/schema";
import {
  GroupTopicId,
  TopicId,
  UserId,
} from "~/api-contract/subscription/subscription";
import { OnlineUsers } from "~/backend/service/common/online-users";
import { getPermissionInP2PTopic } from "~/backend/service/auth/common/repo";
import {
  getSubscribersOfTopic,
  getFullnameOfUsers,
} from "~/backend/service/topics/common/repo/repo";
import { permission } from "~/backend/service/common/permissions";
import { IsUserId } from "~/backend/service/common/topics";
import { ServiceResult } from "~/api-contract/types";
import { AppError } from "~/api-contract/errors/errors";

export default async function notifyIsTyping(
  ctx: {
    onlineUsers: OnlineUsers;
    db: KyselyDB;
  },
  arg: {
    action: "typing" | "stop-typing";
    notifierId: UserId;
    topicId: UserId | GroupTopicId;
  }
): ServiceResult<"topic/notify_typing"> {
  if (arg.action == "typing") {
    ctx.onlineUsers.isTyping(arg.notifierId, arg.topicId, new Date());
  } else {
    ctx.onlineUsers.stopTyping(arg.notifierId);
  }

  if (IsUserId(arg.topicId)) {
    const user = ctx.onlineUsers.get(arg.topicId);
    if (user == undefined) {
      return ok({});
    }

    // check permission to receive notification
    {
      const r = await getPermissionInP2PTopic(ctx.db, {
        peer1: arg.notifierId,
        peer2: arg.topicId,
        permissionRequested: "peer2",
      });
      if (r.isErr()) {
        if (r.error.type == "No topic found") {
          return ok({});
        } else {
          throw r.error;
        }
      }

      if (!permission(r.value.permissions).canGetNotifiedOfPresence()) {
        return ok({});
      }
    }

    user.sockets.next({
      event: "notification.typing",
      payload: {
        type: "p2p",
        topicId: arg.notifierId,
        action: arg.action,
      },
    });
    return ok({});
  } else {
    const subs = await getSubscribersOfTopic(ctx.db, arg.topicId);
    if (subs.isErr()) {
      return err(new AppError("UNKNOWN", { cause: subs.error }));
    }

    const typingUsers = getTypingUsers(ctx.onlineUsers, arg.topicId);

    const usersFullname = await getFullnameOfUsers(
      ctx.db,
      typingUsers.map((u) => u.id)
    );
    if (usersFullname.isErr()) {
      return err(new AppError("UNKNOWN", { cause: usersFullname.error }));
    }

    for (const { subscriberId } of subs.value) {
      const user = ctx.onlineUsers.get(subscriberId);
      if (user == undefined) {
        continue;
      }

      const latestTypingId = getLatestTyping(typingUsers);
      const latestTyping = latestTypingId
        ? usersFullname.value.find((u) => u.id == latestTypingId)
        : null;

      user.sockets.next({
        event: "notification.typing",
        payload: {
          type: "grp",
          topicId: arg.topicId,
          typing: usersFullname.value,
          latestTyping: latestTyping ? latestTyping : null,
        },
      });
    }
  }

  return ok({});
}

const getTypingUsers = (onlineUsers: OnlineUsers, topicId: GroupTopicId) => {
  const users: { id: UserId; timeStartTyping: Date }[] = [];
  for (const [k, u] of onlineUsers.entries()) {
    if (u.typing && u.typing.topicId == topicId) {
      users.push({
        id: k,
        timeStartTyping: u.typing.timeStartTyping,
      });
    }
  }
  return users;
};

const getLatestTyping = (
  typingUsers: {
    id: UserId;
    timeStartTyping: Date;
  }[]
) => {
  if (typingUsers.length == 0) {
    return null;
  }

  // get the time that is biggest, and return its topic id
  let latestTypingUser = typingUsers[0];

  for (const v of typingUsers) {
    if (
      v.timeStartTyping.getTime() > latestTypingUser.timeStartTyping.getTime()
    ) {
      latestTypingUser = v;
    }
  }

  return latestTypingUser.id;
};

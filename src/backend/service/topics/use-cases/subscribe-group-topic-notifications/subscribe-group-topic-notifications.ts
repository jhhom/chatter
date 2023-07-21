import { OnlineUsers } from "~/backend/service/common/online-users";
import { UserId, GroupTopicId } from "~/backend/drizzle/schema";

export function subscribeToGroupTopicNotifications(
  ctx: {
    onlineUsers: OnlineUsers;
  },
  arg: {
    subscriberId: UserId;
    groupTopicId: GroupTopicId;
  }
) {
  ctx.onlineUsers.subscribeUserToGroup(arg.subscriberId, arg.groupTopicId);
}

export function unsubscribeFromGroupTopicNotifications(
  ctx: {
    onlineUsers: OnlineUsers;
  },
  arg: {
    subscriberId: UserId;
    groupTopicId: GroupTopicId;
  }
) {
  ctx.onlineUsers.unsubscribeUserToGroup(arg.subscriberId, arg.groupTopicId);
}

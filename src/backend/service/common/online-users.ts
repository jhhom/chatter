import { Socket } from "~/backend/router/socket";
import type { GroupTopicId, UserId } from "~/backend/drizzle/schema";
import { Sockets } from "./sockets";

type User = {
  sockets: Sockets;
  /** the contact user is typing to, if user is not typing, this will be undefined */
  typing?: {
    topicId: UserId | GroupTopicId;
    timeStartTyping: Date;
  };
};

export type GroupOnlineStatusChangeNotificationListItem = {
  userId: UserId;
  topicId: GroupTopicId;
};

class OnlineUsers {
  /**
   * The list of users who are currently online
   */
  #onlineUsers: Map<UserId, User>;

  /**
   * The list of groups, and for each group
   *
   * - a list of currently online members
   * - a list of members who are subscribed to receive detailed notifications of latest online members
   */
  #groups: Map<
    GroupTopicId,
    {
      /**
       * a list of currently online members
       */
      onlineMembers: Set<UserId>;
      /**
       * a list of members who are subscribed to receive detailed notifications of latest online members
       */
      onlineStatusChangeSubscribers: Set<UserId>;
    }
  >;

  constructor() {
    this.#onlineUsers = new Map();
    this.#groups = new Map();
  }

  /**
   * This function should be used for testing only
   *
   * Used for inspecting the internal state of `OnlineUsers`
   */
  static _values(onlineUsers: OnlineUsers) {
    return {
      onlineUsers: onlineUsers.#onlineUsers,
      groups: onlineUsers.#groups,
    } as const;
  }

  onlineMemberListChangeNotificationSubscribers(groupTopicId: GroupTopicId) {
    const grp = this.#groups.get(groupTopicId);
    if (grp == undefined) {
      return [];
    }
    return Array.from(grp.onlineStatusChangeSubscribers.values());
  }

  onlineMembersOfGroup(groupTopicId: GroupTopicId) {
    const grp = this.#groups.get(groupTopicId);
    if (grp == undefined) {
      return [];
    }
    return Array.from(grp.onlineMembers.values());
  }

  /**
   * queryUserId is needed because we need to know if the user id to know if the topic is typing to the user or not (for p2p topics)
   *
   * @param queryUserId The user id of the user querying the status of this topic
   * @param topicId The topic id of the topic whose status being queried
   * @returns
   */
  isGroupTopicOnline(topicId: GroupTopicId) {
    const group = this.#groups.get(topicId);
    if (group != undefined && group.onlineMembers.size > 1) {
      return { isOnline: true as const, typing: undefined, topicId };
    }
    // TODO: implement typing recording for group topic later
    return { isOnline: false, topicId, typing: undefined } as const;
  }

  isUserOnline(userId: UserId) {
    return this.#onlineUsers.has(userId);
  }

  /**
   * queryUserId is needed because we need to know if the user id to know if the topic is typing to the user or not (for p2p topics)
   *
   * @param queryUserId The user id of the user querying the status of this topic
   * @param topicId The topic id of the topic whose status being queried
   * @returns
   */
  isP2PUserOnline(queryUserId: UserId, topicId: UserId) {
    const user = this.#onlineUsers.get(topicId);
    if (user == undefined) {
      return { isOnline: false, topicId } as const;
    }
    return {
      isOnline: true,
      typing: user.typing ? user.typing.topicId == queryUserId : false,
      topicId,
    } as const;
  }

  get(userId: UserId) {
    return this.#onlineUsers.get(userId);
  }

  /**
   *
   * @param userId id of the user that comes online
   * @param groupIds the list of group this user should be added to as an online member
   * @param socket socket of the user
   *
   * @returns a list of groups that have just goes online, and the user that needs to be notified
   * a group that changes from 2 members to 3 members, has no need to notify, because group's online status doesn't change for those 3 members
   * a group that changes from 1 member to 2 members as a result of this operation, will appear that group has turned from offline to online for that one member,
   * and we need to notify that one member
   * a group that changes from 0 to 1 member, has no need to notify
   */
  add(
    userId: UserId,
    groupIds: GroupTopicId[],
    socket: Socket
  ): {
    socketId: string;
    toNotify: GroupOnlineStatusChangeNotificationListItem[];
  } {
    const toNotify: GroupOnlineStatusChangeNotificationListItem[] = [];

    const user = this.#onlineUsers.get(userId);

    const socketId = (() => {
      let socketId = "";
      if (user) {
        socketId = user.sockets.add(socket);
      } else {
        const sockets = new Sockets();
        socketId = sockets.add(socket);
        this.#onlineUsers.set(userId, { sockets });
      }
      return socketId;
    })();

    for (const id of groupIds) {
      const statusChange = this.#addUserIntoGroup(userId, id);
      if (statusChange.change) {
        toNotify.push({
          userId: statusChange.toNotify,
          topicId: id,
        });
      }
    }

    return { socketId, toNotify };
  }

  /**
   * @param userId
   * @param groupId
   * @returns whether the status of the group (online/offline) has changed in response to the addition of the member
   */
  #addUserIntoGroup(
    userId: UserId,
    groupId: GroupTopicId
  ): { change: false } | { change: true; toNotify: UserId } {
    const group = this.#groups.get(groupId);
    if (group === undefined) {
      this.#groups.set(groupId, {
        onlineMembers: new Set([userId]),
        onlineStatusChangeSubscribers: new Set(),
      });
      return { change: false };
    }
    let causesStatusChange =
      group.onlineMembers.size == 1 && !group.onlineMembers.has(userId);
    let toNotify: UserId | null = null;
    if (causesStatusChange) {
      toNotify = group.onlineMembers.values().next().value;
    }
    group.onlineMembers.add(userId);
    if (!causesStatusChange) {
      return { change: false };
    }
    return { change: true, toNotify: toNotify! };
  }

  /**
   * @param userId
   * @param groupId
   * @returns whether status of group (online/offline) has changed in response to the addition of the member
   */
  addOnlineUserToGroup(userId: UserId, groupId: GroupTopicId) {
    if (this.#onlineUsers.has(userId)) {
      return this.#addUserIntoGroup(userId, groupId);
    }
    return { change: false };
  }

  removeOnlineUserFromGroup(
    userId: UserId,
    groupId: GroupTopicId
  ):
    | {
        change: false;
      }
    | {
        change: true;
        toNotify: UserId;
      } {
    if (!this.#onlineUsers.has(userId)) {
      return { change: false };
    }
    const grp = this.#groups.get(groupId);
    if (!grp) {
      return { change: false };
    }

    grp.onlineStatusChangeSubscribers.delete(userId);

    if (grp.onlineMembers.size == 2 && grp.onlineMembers.has(userId)) {
      grp.onlineMembers.delete(userId);
      return {
        change: true,
        toNotify: grp.onlineMembers.values().next().value,
      };
    }
    grp.onlineMembers.delete(userId);
    return { change: false };
  }

  has(userId: UserId) {
    return this.#onlineUsers.has(userId);
  }

  /**
   *
   * @param userId
   * @returns a list of groups that have just goes offline, and the user that needs to be notified
   * a group that changes from 3 members to 2 members, has no need to notify, because group's online status doesn't change for those 2 members
   * a group that changes from 2 members to 1 member as a result of this operation, will appear that group has turned from online to offline for that one member,
   * and we need to notify that one member
   * a group that changes from 1 to 0 member, has no member to be notified
   */
  remove(
    userId: UserId,
    socketId: string
  ): {
    isUserStillOnline: boolean;
    /** a list of groups where status change from online to offline, and the only member currently left on each group */
    toNotify: GroupOnlineStatusChangeNotificationListItem[];
    /** a list of groups where the user is removed as an online member */
    groupsUserIsRemoved: GroupTopicId[];
  } {
    const toNotify: GroupOnlineStatusChangeNotificationListItem[] = [];
    const groupsUserIsRemoved: GroupTopicId[] = [];

    const user = this.#onlineUsers.get(userId);
    if (user) {
      user.sockets.remove(socketId);
    }

    if (user && user.sockets.isEmpty()) {
      this.#onlineUsers.delete(userId);

      // remove user from every group
      for (const [k, v] of this.#groups.entries()) {
        v.onlineStatusChangeSubscribers.delete(userId);

        if (!v.onlineMembers.has(userId)) {
          continue;
        }
        if (v.onlineMembers.size == 2) {
          const onlineMembers = Array.from(v.onlineMembers.values());
          const uid =
            onlineMembers[0] == userId ? onlineMembers[1] : onlineMembers[0];
          if (uid) {
            toNotify.push({
              userId: uid,
              topicId: k,
            });
          }
        }

        v.onlineMembers.delete(userId);
        groupsUserIsRemoved.push(k);
      }
    }

    return {
      isUserStillOnline: !user?.sockets.isEmpty(),
      toNotify,
      groupsUserIsRemoved,
    };
  }

  entries() {
    return this.#onlineUsers.entries();
  }

  isTyping(userId: UserId, contact: UserId | GroupTopicId, timeStarted: Date) {
    const user = this.#onlineUsers.get(userId);
    if (user) {
      user.typing = {
        topicId: contact,
        timeStartTyping: timeStarted,
      };
    }
  }

  stopTyping(userId: UserId) {
    const user = this.#onlineUsers.get(userId);
    if (user) {
      user.typing = undefined;
    }
  }

  subscribeUserToGroup(subscriberId: UserId, groupId: GroupTopicId) {
    const grp = this.#groups.get(groupId);
    if (grp == undefined) {
      this.#groups.set(groupId, {
        onlineMembers: new Set([subscriberId]),
        onlineStatusChangeSubscribers: new Set([subscriberId]),
      });
    } else {
      grp.onlineStatusChangeSubscribers.add(subscriberId);
    }
  }

  unsubscribeUserToGroup(subscriberId: UserId, groupId: GroupTopicId) {
    const grp = this.#groups.get(groupId);
    if (grp == undefined) {
      return;
    }
    grp.onlineStatusChangeSubscribers.delete(subscriberId);
  }
}

export { OnlineUsers };

export type GroupTopicId = `grp${string}`;
export type P2PTopicId = `p2p${string}`;
export type TopicId = P2PTopicId | GroupTopicId;
export type UserId = `usr${string}`;
export type UserTopicId = UserId | GroupTopicId;

type MessagePayload = {
  text: {
    forwarded: boolean;
    content: string;
  };
  picture: {
    filename: string;
    forwarded: boolean;
    url: string;
    caption: string;
    /** size in number of bytes */
    size: number;
  };
  file: {
    filename: string;
    forwarded: boolean;
    url: string;
    caption: string;
    /** size in number of bytes */
    size: number;
  };
};

export type Message = {
  [k in keyof MessagePayload]: { type: k } & MessagePayload[k];
}[keyof MessagePayload];

type GeneralOnlineNotification = {
  topicId: UserId | GroupTopicId;
};

export type MessageContent = Message & {
  replyTo: null | (Message & { seqId: number; authorId: UserId });
};

type TopicEventPayload = {
  add_member: {
    name: string;
    online: boolean;
    profilePhotoUrl: string | null;
  };
  ["join-group-through-invite-link"]: {
    name: string;
    online: boolean;
    profilePhotoUrl: string | null;
  };
  ["join-group-through-id"]: {
    name: string;
    online: boolean;
    profilePhotoUrl: string | null;
  };
  change_member_permission: Record<string, never>;
  remove_member: Record<string, never>;
  create_group: Record<string, never>;
  leave_group: {
    newOwnerId?: UserId;
  };
};

type TopicEventEvent = {
  [k in keyof TopicEventPayload]: { event: k; payload: TopicEventPayload[k] };
}[keyof TopicEventPayload];

export type EventPayload = {
  message: {
    content: MessageContent;
    authorId: UserId;
    topicId: UserId | GroupTopicId;
    seqId: number;
    createdAt: Date;
    isFirstOfDate: boolean;
    /** only used for group topic where front-end is not caching the name of the author
     * thus needs back-end to provide the author's name
     */
    lastMessageContent: string | null;
  };
  "message.from-new-topic": {
    content: MessageContent;
    authorId: UserId;
    topicId: UserId;
    topic: {
      userId: UserId;
      name: string;
      touchedAt: null | Date;
      profilePhotoUrl: string | null;
      userPermissions: string;
      peerPermissions: string;
      online: boolean;
    };
    seqId: number;
    createdAt: Date;
    isFirstOfDate: boolean;
  };
  "notification.message-deleted": {
    deletedFor: "self" | "everyone";
    topicId: UserId | GroupTopicId;
    seqId: number;
  };
  "notification.added-to-group": {
    groupId: GroupTopicId;
    groupName: string;
    groupDefaultPermission: string;
    userPermission: string;
    profilePhotoUrl: string | null;
    ownerId: UserId;
    status:
      | {
          online: false;
        }
      | {
          online: true;
          latestTyping: {
            id: UserId;
            fullname: string;
          } | null;
        };
  };
  "notification.group-deleted": {
    topicId: GroupTopicId;
  };
  "notification.topic-event": {
    event: TopicEventEvent;
    topicId: GroupTopicId;
    message: string;
    seqId: number;
    createdAt: Date;
    isFirstOfDate: boolean;
    affected: UserId | null;
    actor: UserId;
  };
  "notification.p2p-topic-permission-update": {
    topicId: UserId;
    /**
     * If the peer changes our permission, then `permissionUpdatedOn` will be `self`
     
     * If we changes the peer's permission, then `permissionUpdatedOn` will be `peer`
     *
     * The notification for our own changes is mainly for synchronization purposes only
     *
     * Should the user have multiple devices login-ed, the update on the topic permissions
     * performed on one device should also reflect the changes on the other login-ed devices
     */
    updatedPermission: string;
  } & (
    | {
        permissionUpdatedOn: "self";
        /**
         * An optional status
         *
         * Used for topic permission update
         *
         * If a user regains a P (Presence) permission, they should receive the latest online status of the user
         *
         * Updated on the front-end if this prop is included
         */
        status?: {
          online: boolean;
        };
      }
    | {
        permissionUpdatedOn: "peer";
      }
  );
  "notification.grp-topic-permission-update": {
    topicId: GroupTopicId;
    permissionUpdated: "self" | "default";
    updatedPermission: string;
  };
  "notification.on": GeneralOnlineNotification;
  "notification.off": GeneralOnlineNotification & {
    lastOnline: null | Date;
  };
  "notification.typing":
    | {
        type: "p2p";
        topicId: UserId;
        action: "typing" | "stop-typing";
      }
    | {
        type: "grp";
        topicId: GroupTopicId;
        typing: {
          id: UserId;
          fullname: string;
        }[];
        latestTyping: {
          id: UserId;
          fullname: string;
        } | null;
      };
  "group-chat-notification.online-members": {
    topicId: GroupTopicId;
    onlineMembers: UserId[];
  };
  read: {
    topicId: TopicId;
    topicUserId: UserId;
    lastReadSeqId: number;
  };
};

// https://effectivetypescript.com/2020/05/12/unionize-objectify/
export type SubscriptionMessage = {
  [k in keyof EventPayload]: { event: k; payload: EventPayload[k] };
}[keyof EventPayload];

import { useRouter } from "next/navigation";
import { match } from "ts-pattern";
import { ok, err } from "neverthrow";

import { EventPayload } from "~/api-contract/subscription/subscription";
import { IsGroupTopicId, IsUserId } from "~/backend/service/common/topics";
import { permission } from "~/backend/service/common/permissions";

import { client } from "~/frontend/external/api-client/client";
import { dexie } from "~/frontend/external/browser/indexed-db";
import { useAppStore } from "~/frontend/stores/stores";

type ListenerToRegister = Partial<{
  [k in keyof EventPayload]: (payload: EventPayload[k]) => void;
}>;

export const useLoginHandler = () => {
  const store = useAppStore();
  const router = useRouter();

  const updateTopics = async () => {
    const topicResult = await client["users/topics"]();
    if (topicResult.isErr()) {
      return err(topicResult.error);
    }
    store.clearContacts("all");

    for (const t of topicResult.value) {
      if (t.type == "p2p") {
        store.setP2PContact(t.topicId, {
          profile: {
            name: t.topicName,
            description: "",
            touchedAt: t.touchedAt,
            peerPermissions: t.peerPermissions,
            userPermissions: t.userPermissions,
            profilePhotoUrl: t.profilePhotoUrl,
            lastMessage: t.lastMessage,
          },
          status: {
            lastOnline: t.lastOnline,
            online: false,
          },
        });
      } else if (t.type == "grp") {
        store.setGrpContact(t.topicId, {
          profile: {
            defaultPermissions: t.defaultPermissions,
            name: t.topicName,
            description: "",
            touchedAt: t.touchedAt,
            userPermissions: t.userPermissions,
            profilePhotoUrl: t.profilePhotoUrl,
            lastMessage: t.lastMessage,
            ownerId: t.ownerId,
          },
          status: {
            online: false,
          },
        });
      } else {
        store.setPastGrpContact(t.topicId, {
          profile: {
            name: t.topicName,
            description: "",
            touchedAt: t.touchedAt,
            profilePhotoUrl: t.profilePhotoUrl,
            lastMessage: t.lastMessage,
          },
        });
      }
    }

    return ok({});
  };

  const updateTopicStatus = async () => {
    const topicStatus = await client["users/contact_status"]();
    if (topicStatus.isErr()) {
      return err(topicStatus.error);
    }
    for (const s of topicStatus.value.groupContactStatus) {
      const c = store.grp.get(s.topicId);
      if (c == undefined) {
        continue;
      }
      if (s.online) {
        store.setGrpContact(s.topicId, {
          ...c,
          status: {
            online: s.online,
            typing: [],
            latestTyping: null,
          },
        });
      } else {
        store.setGrpContact(s.topicId, {
          ...c,
          status: { online: s.online },
        });
      }
    }
    for (const s of topicStatus.value.p2pContactStatus) {
      const c = store.p2p.get(s.topicId);
      if (c == undefined) {
        console.log("UNDEFFINED!!", s.topicId);
        continue;
      }
      if (s.online) {
        console.log("USER UPDATED AS ONLINE");
        store.setP2PContact(s.topicId, {
          ...c,
          status: {
            online: s.online,
            typing: s.typing ?? false,
          },
        });
      } else {
        store.setP2PContact(s.topicId, {
          ...c,
          status: { online: s.online, lastOnline: s.lastOnline },
        });
      }
    }

    return ok({});
  };

  const retrieveUnreadMessages = async () => {
    const unreadMessages = await client["topic/unread_messages"]();
    if (unreadMessages.isErr()) {
      return err(unreadMessages.error);
    }

    for (const topic of unreadMessages.value.p2pTopics) {
      await dexie.messages.bulkAdd(
        topic.messages.map((m) => ({
          content: m.content,
          seqId: m.sequenceId,
          authored: m.author == store.profile?.userId,
          topicId: topic.topic.id,
          createdAt: m.createdAt,
          read: m.read,
          isFirstOfDate: m.isFirstOfDate,
          author: m.author,
          deleted: m.deleted,
        }))
      );

      await dexie.messages.bulkAdd(
        topic.eventLogs.map((l) => ({
          content: { ...l.content, replyTo: null } as {
            type: "text";
            content: string;
            forwarded: false;
            replyTo: null;
          },
          seqId: l.sequenceId,
          authored: false,
          topicId: topic.topic.id,
          createdAt: l.createdAt,
          read: l.read,
          isFirstOfDate: l.isFirstOfDate,
          author: null,
          deleted: false,
        }))
      );

      await dexie.topicEventLogs.bulkAdd(
        topic.eventLogs.map((l) => ({
          seqId: l.sequenceId,
          topicId: topic.topic.id,
          topicEvent: l.event,
        }))
      );
    }

    for (const topic of unreadMessages.value.grpTopics) {
      await dexie.messages.bulkAdd(
        topic.messages.map((m) => ({
          content: m.content,
          seqId: m.sequenceId,
          authored: m.author == store.profile?.userId,
          topicId: topic.topic.id,
          createdAt: m.createdAt,
          read: m.read,
          isFirstOfDate: m.isFirstOfDate,
          author: m.author,
          deleted: m.deleted,
        }))
      );

      await dexie.messages.bulkAdd(
        topic.eventLogs.map((l) => ({
          content: { ...l.content, replyTo: null } as {
            type: "text";
            content: string;
            forwarded: false;
            replyTo: null;
          },
          seqId: l.sequenceId,
          authored: false,
          topicId: topic.topic.id,
          createdAt: l.createdAt,
          read: l.read,
          isFirstOfDate: l.isFirstOfDate,
          author: null,
          deleted: false,
        }))
      );

      await dexie.topicEventLogs.bulkAdd(
        topic.eventLogs.map((l) => ({
          seqId: l.sequenceId,
          topicId: topic.topic.id,
          topicEvent: l.event,
        }))
      );
    }

    return ok({});
  };

  const listeners: ListenerToRegister = {
    ["notification.p2p-topic-permission-update"]: (payload) => {
      const c = store.p2p.get(payload.topicId);
      if (c == undefined) {
        return;
      }
      if (payload.permissionUpdatedOn == "self") {
        if (payload.status !== undefined) {
          c.status = payload.status
            ? payload.status.online
              ? {
                  online: true,
                  typing: false,
                }
              : {
                  online: false,
                  lastOnline: c.status.online ? null : c.status.lastOnline,
                }
            : c.status;
        }
        c.profile.userPermissions = payload.updatedPermission;
        if (!permission(payload.updatedPermission).canGetNotifiedOfPresence()) {
          c.status = {
            online: false,
            lastOnline: null,
          };
        }
        store.setP2PContact(payload.topicId, {
          profile: c.profile,
          status: c.status,
        });
      } else {
        store.setP2PContact(payload.topicId, {
          profile: {
            ...c.profile,
            peerPermissions: payload.updatedPermission,
          },
          status: c.status,
        });
      }
    },
    ["notification.topic-event"]: async (payload) => {
      await dexie.messages.add({
        seqId: payload.seqId,
        topicId: payload.topicId,
        content: {
          type: "text",
          content: payload.message,
          forwarded: false,
          replyTo: null,
        },
        author: null,
        read: false,
        isFirstOfDate: payload.isFirstOfDate,
        createdAt: payload.createdAt,
        deleted: false,
      });
      await dexie.topicEventLogs.add({
        seqId: payload.seqId,
        topicEvent: payload.event.event,
        topicId: payload.topicId,
      });

      {
        const grp = store.grp.get(payload.topicId);
        if (grp) {
          store.setGrpContact(payload.topicId, {
            ...grp,
            profile: {
              ...grp.profile,
              ownerId:
                payload.event.event == "leave_group" &&
                payload.event.payload.newOwnerId
                  ? payload.event.payload.newOwnerId
                  : grp.profile.ownerId,
              touchedAt: payload.createdAt,
              lastMessage: {
                sequenceId: payload.seqId,
                type: "message",
                content: payload.message,
              },
            },
          });
        }
      }

      if (
        (payload.event.event == "remove_member" &&
          payload.affected == store.profile?.userId) ||
        (payload.event.event == "leave_group" &&
          payload.actor == store.profile?.userId)
      ) {
        const grp = store.grp.get(payload.topicId);
        store.deletePastGrp(payload.topicId);

        if (grp) {
          store.setPastGrpContact(payload.topicId, {
            profile: {
              name: grp.profile.name,
              description: grp.profile.description,
              touchedAt: grp.profile.touchedAt,
              profilePhotoUrl: grp.profile.profilePhotoUrl,
              lastMessage: {
                sequenceId: payload.seqId,
                type: "message",
                content: payload.message,
              },
            },
          });
        }
      }
    },
    ["notification.added-to-group"]: (payload) => {
      store.deletePastGrp(payload.groupId);

      store.setGrpContact(payload.groupId, {
        profile: {
          name: payload.groupName,
          description: "",
          touchedAt: null,
          userPermissions: payload.userPermission,
          defaultPermissions: payload.groupDefaultPermission,
          profilePhotoUrl: payload.profilePhotoUrl,
          lastMessage: {
            content: "You are added into the group",
            sequenceId: 0,
            type: "message",
          },
          ownerId: payload.ownerId,
        },
        status: payload.status.online
          ? {
              online: true,
              latestTyping: payload.status.latestTyping,
              typing: [],
            }
          : {
              online: false,
            },
      });
    },
    ["notification.grp-topic-permission-update"]: (payload) => {
      const c = store.grp.get(payload.topicId);
      if (c == undefined) {
        return;
      }
      if (payload.permissionUpdated == "default") {
        store.setGrpContact(payload.topicId, {
          profile: {
            ...c.profile,
            defaultPermissions: payload.updatedPermission,
          },
          status: c.status,
        });
      } else {
        store.setGrpContact(payload.topicId, {
          profile: {
            ...c.profile,
            userPermissions: payload.updatedPermission,
          },
          status: c.status,
        });
      }
    },
    ["notification.on"]: (payload) => {
      console.log("NOTIFICATION.ON");
      if (IsGroupTopicId(payload.topicId)) {
        const c = store.grp.get(payload.topicId);
        if (c == undefined) {
          return;
        }
        store.setGrpContact(payload.topicId, {
          ...c,
          status: {
            online: true,
            typing: [],
            latestTyping: null,
          },
        });
      } else {
        console.log("UPDATE CONTACT TO ONLINE STATUS", payload.topicId);
        const c = store.p2p.get(payload.topicId);
        if (c == undefined) {
          return;
        }
        console.log("UPDATE CONTACT TO ONLINE STATUS", payload.topicId);
        store.setP2PContact(payload.topicId, {
          ...c,
          status: {
            online: true,
            typing: false,
          },
        });
      }
    },
    ["notification.off"]: (payload) => {
      if (IsGroupTopicId(payload.topicId)) {
        const c = store.grp.get(payload.topicId);
        if (c == undefined) {
          return;
        }
        store.setGrpContact(payload.topicId, {
          ...c,
          status: {
            online: false,
          },
        });
      } else {
        const c = store.p2p.get(payload.topicId);
        if (c == undefined) {
          return;
        }
        store.setP2PContact(payload.topicId, {
          ...c,
          status: {
            online: false,
            lastOnline: payload.lastOnline,
          },
        });
      }
    },
    ["notification.group-deleted"]: async (payload) => {
      if (
        location.pathname.startsWith(`/?topic=${payload.topicId}`) ||
        location.pathname.startsWith(`?topic=${payload.topicId}`)
      ) {
        router.push("/");
      }
      store.deleteGrp(payload.topicId);
      await dexie.messages.where("topicId").equals(payload.topicId).delete();
      await dexie.topicEventLogs
        .where("topicId")
        .equals(payload.topicId)
        .delete();
    },
    ["notification.typing"]: (payload) => {
      if (payload.type == "grp") {
        const c = store.grp.get(payload.topicId);
        if (c === undefined || !c.status.online) {
          return;
        }
        store.setGrpContact(payload.topicId, {
          ...c,
          status: {
            online: true,
            typing: payload.typing,
            latestTyping: payload.latestTyping,
          },
        });
      } else {
        const c = store.p2p.get(payload.topicId);
        if (c === undefined || !c.status.online) {
          return;
        }
        store.setP2PContact(payload.topicId, {
          ...c,
          status: {
            online: true,
            typing: payload.action == "typing",
          },
        });
      }
    },
    ["notification.message-deleted"]: async (payload) => {
      if (payload.deletedFor == "self") {
        await dexie.messages.delete([payload.topicId, payload.seqId]);
      } else {
        await dexie.messages.update([payload.topicId, payload.seqId], {
          content: {
            type: "text",
            forwarded: false,
            content: "",
          },
          deleted: true,
        });

        if (IsUserId(payload.topicId)) {
          const c = store.p2p.get(payload.topicId);
          if (c) {
            store.setP2PContact(payload.topicId, {
              profile: {
                ...c.profile,
                lastMessage: {
                  type: "deleted",
                  sequenceId: payload.seqId,
                },
              },
              status: c.status,
            });
          }
        } else {
          const c = store.grp.get(payload.topicId);
          if (c) {
            store.setGrpContact(payload.topicId, {
              profile: {
                ...c.profile,
                lastMessage: {
                  type: "deleted",
                  sequenceId: payload.seqId,
                },
              },
              status: c.status,
            });
          }
        }
      }
    },
    read: async (payload) => {
      await dexie.messages
        .where(["topicId", "seqId"])
        .below([payload.topicUserId, payload.lastReadSeqId])
        .and((x) => x.author == store.profile?.userId)
        .modify({ read: true })
        .catch((err: unknown) => {
          console.error("UPDATE READ STATUS ERROR", err);
        });
    },
    message: async (payload) => {
      await dexie.messages.add({
        seqId: payload.seqId,
        topicId: payload.topicId,
        content: payload.content,
        author: payload.authorId,
        createdAt: payload.createdAt,
        read: false,
        isFirstOfDate: payload.isFirstOfDate,
        deleted: false,
      });

      {
        if (IsGroupTopicId(payload.topicId)) {
          const grp = store.grp.get(payload.topicId);
          if (grp) {
            store.setGrpContact(payload.topicId, {
              ...grp,
              profile: {
                ...grp.profile,
                lastMessage: payload.lastMessageContent
                  ? {
                      type: "message",
                      sequenceId: payload.seqId,
                      content: payload.lastMessageContent,
                    }
                  : grp.profile.lastMessage,
                touchedAt: payload.createdAt,
              },
            });
          }
        } else {
          const peer = store.p2p.get(payload.topicId);
          if (peer) {
            const authorName =
              payload.authorId === store.profile?.userId
                ? "You"
                : peer.profile.name;

            store.setP2PContact(payload.topicId, {
              ...peer,
              profile: {
                ...peer.profile,
                lastMessage: {
                  type: "message",
                  sequenceId: payload.seqId,
                  content: match(payload.content)
                    .with({ type: "file" }, () => `${authorName} sent a file`)
                    .with(
                      { type: "picture" },
                      () => `${authorName} sent a picture`
                    )
                    .with({ type: "text" }, (c) => c.content)
                    .exhaustive(),
                },
                touchedAt: payload.createdAt,
              },
            });
          }
        }
      }
    },
    ["message.from-new-topic"]: async (payload) => {
      await dexie.messages.add({
        seqId: payload.seqId,
        topicId: payload.topicId,
        content: payload.content,
        author: payload.authorId,
        createdAt: payload.createdAt,
        read: false,
        isFirstOfDate: payload.isFirstOfDate,
        deleted: false,
      });

      store.deleteNewContact(payload.topicId);

      const authorName =
        payload.authorId === store.profile?.userId ? "You" : payload.topic.name;

      store.setP2PContact(payload.topicId, {
        profile: {
          name: payload.topic.name,
          description: "",
          userPermissions: payload.topic.userPermissions,
          peerPermissions: payload.topic.peerPermissions,
          touchedAt: payload.topic.touchedAt,
          profilePhotoUrl: payload.topic.profilePhotoUrl,
          lastMessage: {
            type: "message",
            content: match(payload.content)
              .with({ type: "file" }, () => `${authorName} sent a file`)
              .with({ type: "picture" }, () => `${authorName} sent a picture`)
              .with({ type: "text" }, (c) => c.content)
              .exhaustive(),
            sequenceId: payload.seqId,
          },
        },
        status: payload.topic.online
          ? {
              online: true,
              typing: false,
            }
          : {
              online: false,
              lastOnline: null,
            },
      });
    },
  };

  return {
    onLoginSuccess: async (_response: {
      username: string;
      email: string;
      fullname: string;
    }) => {
      {
        const r = await updateTopics();
        if (r.isErr()) {
          return err(r.error);
        }
      }
      {
        const r = await updateTopicStatus();
        if (r.isErr()) {
          return err(r.error);
        }
      }
      {
        const r = await retrieveUnreadMessages();
        if (r.isErr()) {
          return err(r.error);
        }
      }

      if (listeners.message) {
        client.addListener("message", listeners.message);
      }
      if (listeners["message.from-new-topic"]) {
        client.addListener(
          "message.from-new-topic",
          listeners["message.from-new-topic"]
        );
      }
      if (listeners["notification.message-deleted"]) {
        client.addListener(
          "notification.message-deleted",
          listeners["notification.message-deleted"]
        );
      }
      if (listeners["notification.p2p-topic-permission-update"]) {
        client.addListener(
          "notification.p2p-topic-permission-update",
          listeners["notification.p2p-topic-permission-update"]
        );
      }
      if (listeners["notification.grp-topic-permission-update"]) {
        client.addListener(
          "notification.grp-topic-permission-update",
          listeners["notification.grp-topic-permission-update"]
        );
      }
      if (listeners["notification.off"]) {
        client.addListener("notification.off", listeners["notification.off"]);
      }
      if (listeners["notification.on"]) {
        client.addListener("notification.on", listeners["notification.on"]);
      }
      if (listeners["notification.topic-event"]) {
        client.addListener(
          "notification.topic-event",
          listeners["notification.topic-event"]
        );
      }
      if (listeners["notification.typing"]) {
        client.addListener(
          "notification.typing",
          listeners["notification.typing"]
        );
      }
      if (listeners["group-chat-notification.online-members"]) {
        client.addListener(
          "group-chat-notification.online-members",
          listeners["group-chat-notification.online-members"]
        );
      }
      if (listeners["notification.added-to-group"]) {
        client.addListener(
          "notification.added-to-group",
          listeners["notification.added-to-group"]
        );
      }
      if (listeners["notification.group-deleted"]) {
        client.addListener(
          "notification.group-deleted",
          listeners["notification.group-deleted"]
        );
      }
      if (listeners.read) {
        client.addListener("read", listeners.read);
      }

      return ok({});
    },
  };
};

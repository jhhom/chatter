import { EventPayload } from "~/api-contract/subscription/subscription";
import { GroupTopicId, UserId } from "~/api-contract/subscription/subscription";

import { IChatUI } from "~/frontend-2/features/chat/pages/Chat/subpages/P2PChat.subpage";

import { dexie } from "~/frontend-2/external/browser/indexed-db";
import { client } from "~/frontend-2/external/api-client/client";
import { useMessagesStore } from "~/frontend-2/features/chat/pages/Chat/stores/messages/messages.store";

export function useEventLogListener(
  contactId: () => GroupTopicId
): (
  chatUiControl: IChatUI
) => (payload: EventPayload["notification.topic-event"]) => void {
  const chat = useMessagesStore();

  const makeListener = (chatUiControl: IChatUI) => {
    const listener = (e: EventPayload["notification.topic-event"]) => {
      if (e.topicId != contactId()) {
        return;
      }

      const isUserAtBottomOfScroll = chatUiControl.isUserAtTheBottomOfScroll();

      // 1. ADD EVENT LOG INTO UI
      chat.addMessage(
        {
          type: "event_log",
          text: {
            type: "text",
            content: e.message,
            forwarded: false,
          },
          seqId: e.seqId,
          isFirstOfDate: e.isFirstOfDate,
          date: e.createdAt,
        },
        false
      );

      // 2. UPDATE READ STATUS
      setTimeout(async () => {
        const result = await client["topic/update_message_read_status"]({
          sequenceId: e.seqId,
          topicId: contactId(),
        });
        if (result.isErr()) {
          return;
        }

        await dexie.messages
          .where(["topicId", "seqId"])
          .equals([contactId(), e.seqId])
          .modify({ read: true })
          .then((id) => {})
          .catch((error) => {
            console.error(error);
          });
      }, 1500);

      if (isUserAtBottomOfScroll) {
        chatUiControl.scrollChatToTheBottom();
      }
    };

    return listener;
  };

  return makeListener;
}

export function useGroupEventLogListener(
  contactId: () => GroupTopicId,
  topicMembers: {
    remove: (userId: UserId) => void;
    add: (
      userId: UserId,
      user: { name: string; online: boolean; profilePhotoUrl: string | null }
    ) => void;
  }
) {
  const makeListener = () => {
    const listener = (e: EventPayload["notification.topic-event"]) => {
      if (e.topicId != contactId()) {
        return;
      }

      if (e.event.event == "add_member") {
        if (e.affected !== null) {
          topicMembers.add(e.affected, e.event.payload);
        }
      } else if (e.event.event == "join-group-through-id") {
        topicMembers.add(e.actor, e.event.payload);
      } else if (e.event.event == "join-group-through-invite-link") {
        topicMembers.add(e.actor, e.event.payload);
      } else if (e.event.event == "remove_member") {
        if (e.affected !== null) {
          topicMembers.remove(e.affected);
        }
      } else if (e.event.event == "leave_group") {
        if (e.actor !== null) {
          topicMembers.remove(e.actor);
        }
      }
    };

    return listener;
  };

  return makeListener;
}
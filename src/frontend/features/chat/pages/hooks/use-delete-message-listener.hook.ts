import type { EventPayload } from "~/api-contract/subscription/subscription";

import type { UserTopicId as TopicId } from "~/api-contract/subscription/subscription";
import { useMessagesStore } from "~/frontend/features/chat/pages/stores/messages/messages.store";

export function useDeleteMessageListener(
  contactId: () => TopicId
): (e: EventPayload["notification.message-deleted"]) => void {
  const messagesStore = useMessagesStore();

  const listener = (e: EventPayload["notification.message-deleted"]) => {
    if (e.topicId != contactId()) {
      return;
    }
    for (const [i, msg] of messagesStore.messages.entries()) {
      if (msg.seqId == e.seqId) {
        messagesStore.deleteMessage(i, e.deletedFor);
        return;
      }
    }
  };
  return listener;
}

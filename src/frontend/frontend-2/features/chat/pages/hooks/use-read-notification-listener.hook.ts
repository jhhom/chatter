import type { EventPayload } from "~/api-contract/subscription/subscription";
import type { UserTopicId as TopicId } from "~/api-contract/subscription/subscription";
import { useMessagesStore } from "~/frontend/frontend-2/features/chat/pages/stores/messages/messages.store";

export function useReadListener(
  contactId: TopicId
): () => (e: EventPayload["read"]) => void {
  const messagesStore = useMessagesStore();

  const makeListener = () => {
    const listener = (e: EventPayload["read"]) => {
      // for P2P topic, we ignore if the update user is not the topic we're looking at
      // for Group topic, we ignore if the
      // - topic id is not the topic we're looking at
      if (
        // P2P topic case
        !(
          e.topicUserId == contactId ||
          // Group topic case
          e.topicId == contactId
        )
      ) {
        return;
      }

      for (const [i, msg] of messagesStore.messages.entries()) {
        if (
          msg !== undefined &&
          msg.seqId <= e.lastReadSeqId &&
          msg.type == "message" &&
          !msg.read
        ) {
          messagesStore.setMessage(i, {
            ...msg,
            read: true,
          });
        }
      }
    };
    return listener;
  };

  return makeListener;
}

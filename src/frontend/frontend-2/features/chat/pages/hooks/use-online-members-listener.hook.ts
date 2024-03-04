import type {
  EventPayload,
  TopicId,
} from "~/api-contract/subscription/subscription";
import { useMembersStore } from "~/frontend/frontend-2/features/chat/pages/stores/members/members.store";

export function useOnlineMemberListener(
  contactId: TopicId
): () => (e: EventPayload["group-chat-notification.online-members"]) => void {
  const membersStore = useMembersStore();

  const makeListener = () => {
    const listener = (
      e: EventPayload["group-chat-notification.online-members"]
    ) => {
      if (e.topicId != contactId) {
        return;
      }

      membersStore.members.forEach((v, k) => {
        const onlineSet = new Set(e.onlineMembers);
        if (onlineSet.has(k)) {
          membersStore.setMember(k, {
            ...v,
            online: true,
          });
        } else {
          membersStore.setMember(k, {
            ...v,
            online: false,
          });
        }
      });
    };
    return listener;
  };

  return makeListener;
}

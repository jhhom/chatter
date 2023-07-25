import { useSearchParams } from "next/navigation";
import { IsGroupTopicId, IsUserId } from "~/backend/service/common/topics";

import { MessagesProvider } from "~/frontend/features/chat/pages/stores/messages/messages.store";

import { P2PChatPage } from "~/frontend/features/chat/pages/subpages/P2PChat.subpage";
import { GroupChatPage } from "~/frontend/features/chat/pages/subpages/GroupChat.subpage";
import { PastGroupChatPage } from "~/frontend/features/chat/pages/subpages/PastGroupChat.subpage";
import { useMembersStore } from "~/frontend/features/chat/pages/stores/members/members.store";

import { useAppStore } from "~/frontend/stores/stores";

export default function ChatPage() {
  const store = useAppStore((s) => ({
    p2p: s.p2p,
    newContacts: s.newContacts,
    grp: s.grp,
    pastGrp: s.pastGrp,
  }));

  const searchParams = useSearchParams();
  const topic = searchParams.get("topic");

  const groupMemberStatus = (() => {
    if (topic === null) {
      return null;
    }

    if (IsGroupTopicId(topic)) {
      if (store.grp.has(topic)) {
        return "current-member" as const;
      } else if (store.pastGrp.has(topic)) {
        return "past-member" as const;
      }
    }

    return null;
  })();

  const members = useMembersStore();

  return topic !== null && (IsUserId(topic) || IsGroupTopicId(topic)) ? (
    <>
      {IsUserId(topic) &&
        (store.p2p.has(topic) || store.newContacts.has(topic)) && (
          <MessagesProvider
            contact={{
              type: "p2p",
              topic,
            }}
          >
            <P2PChatPage contactId={topic} />
          </MessagesProvider>
        )}
      {IsGroupTopicId(topic) && groupMemberStatus === "current-member" && (
        <MessagesProvider
          contact={{
            type: "grp",
            topic,
            getTopicMember(userId) {
              return members.members.get(userId);
            },
          }}
        >
          <GroupChatPage contactId={topic} />
        </MessagesProvider>
      )}
      {IsGroupTopicId(topic) && groupMemberStatus === "past-member" && (
        <MessagesProvider
          contact={{
            type: "grp",
            topic,
            getTopicMember(userId) {
              return members.members.get(userId);
            },
          }}
        >
          <PastGroupChatPage contactId={topic} />
        </MessagesProvider>
      )}
    </>
  ) : (
    <div>Fallback</div>
  );
}

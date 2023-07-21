import { useContactStore } from "~/components/hooks/stores/contact-status.store";
import { IsGroupTopicId } from "~/backend/service/common/topics";
import { Conversation } from "~/components/chat/presentations/chat/ChatPage/ChatPage";
import { TopicId } from "~/components/hooks/stores/dexie";

export function ChatPage(props: { topicId: TopicId }) {
  const contact = useContactStore();

  if (IsGroupTopicId(props.topicId)) {
    return (
      <div className="flex h-full w-full items-center justify-center text-center">
        <p>Currently not supporting group conversation</p>
      </div>
    );
  }

  const contactProfile = contact.p2p.get(props.topicId);

  if (contactProfile === undefined) {
    return (
      <div className="flex h-full w-full items-center justify-center text-center">
        <p>Contact not found</p>
      </div>
    );
  }

  return (
    <Conversation
      headerInfo={{
        name: contactProfile.profile.name,
        online: contactProfile.status.online,
        lastSeen: contactProfile.status.online
          ? null
          : contactProfile.status.lastOnline,
        typing: contactProfile.status.online
          ? contactProfile.status.typing
            ? contactProfile.profile.name
            : null
          : null,
        profilePhotoUrl: contactProfile.profile.profilePhotoUrl,
        type: "p2p",
      }}
    />
  );
}

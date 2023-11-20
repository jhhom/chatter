import React, { useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { IsGroupTopicId, IsUserId } from "~/backend/service/common/topics";

import { MessagesProvider } from "~/frontend/frontend-2/features/chat/pages/stores/messages/messages.store";

import { P2PChatPage } from "~/frontend/frontend-2/features/chat/pages/subpages/P2PChat.subpage";
import { GroupChatPage } from "~/frontend/frontend-2/features/chat/pages/subpages/GroupChat.subpage";
import { PastGroupChatPage } from "~/frontend/frontend-2/features/chat/pages/subpages/PastGroupChat.subpage";

import {
  useMembersStore,
  type MemberProfile,
} from "~/frontend/frontend-2/features/chat/pages/stores/members/members.store";
import { useAppStore } from "~/frontend/stores/stores";
import type {
  UserId,
  GroupTopicId,
} from "~/api-contract/subscription/subscription";
import { IconChatLogo } from "~/frontend/frontend-2/features/common/icons";

const P2PTopic = React.memo(function P2PTopic(props: { topic: UserId }) {
  return (
    <MessagesProvider
      contact={{
        type: "p2p",
        topic: props.topic,
      }}
    >
      <P2PChatPage contactId={props.topic} />
    </MessagesProvider>
  );
});

const GroupTopic = React.memo(function GroupTopic(props: {
  topic: GroupTopicId;
  getTopicMember: (userId: UserId) => MemberProfile | undefined;
}) {
  return (
    <MessagesProvider
      contact={{
        type: "grp",
        topic: props.topic,
        getTopicMember: props.getTopicMember,
      }}
    >
      <GroupChatPage contactId={props.topic} />
    </MessagesProvider>
  );
});

const PastGroupTopic = React.memo(function PastGroupTopic(props: {
  topic: GroupTopicId;
  getTopicMember: (userId: UserId) => MemberProfile | undefined;
}) {
  return (
    <MessagesProvider
      contact={{
        type: "grp",
        topic: props.topic,
        getTopicMember: props.getTopicMember,
      }}
    >
      <PastGroupChatPage contactId={props.topic} />
    </MessagesProvider>
  );
});

export default function ChatPage() {
  const store = useAppStore((s) => ({
    p2p: s.p2p,
    newContacts: s.newContacts,
    grp: s.grp,
    pastGrp: s.pastGrp,
    get: s.get,
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

  const getMembers = useMembersStore((s) => s.getMembers);

  const getTopicMember = useCallback(
    (userId: UserId) => {
      return getMembers().get(userId);
    },
    [getMembers]
  );

  return topic !== null && (IsUserId(topic) || IsGroupTopicId(topic)) ? (
    <>
      {IsUserId(topic) &&
        (store.p2p.has(topic) || store.newContacts.has(topic)) && (
          <P2PTopic topic={topic} />
        )}
      {IsGroupTopicId(topic) && groupMemberStatus === "current-member" && (
        <GroupTopic topic={topic} getTopicMember={getTopicMember} />
      )}
      {IsGroupTopicId(topic) && groupMemberStatus === "past-member" && (
        <PastGroupTopic
          topic={topic}
          getTopicMember={(userId) => getMembers().get(userId)}
        />
      )}
    </>
  ) : (
    <div className="flex h-full items-center justify-center">
      <div className="flex">
        <IconChatLogo className="ml-2 h-10 w-10 text-primary-500" />
        <div className="flex items-center pl-2.5 text-2xl font-semibold text-primary-500">
          <p>Chatter</p>
        </div>
      </div>
    </div>
  );
}

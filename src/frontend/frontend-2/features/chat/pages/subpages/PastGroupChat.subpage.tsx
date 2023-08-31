import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import useAsyncEffect from "use-async-effect";
import { fromPromise } from "neverthrow";
import type {
  GroupTopicId,
  UserId,
} from "~/api-contract/subscription/subscription";
import clsx from "clsx";

import { ChatConversation } from "~/frontend/frontend-2/features/chat/pages/components2/ChatConversation/ChatConversation";
import type {
  IChatUI,
  IChatConversationUI,
} from "~/frontend/frontend-2/features/chat/pages/types";
import {
  useDeleteMessageListener,
  useEventLogListener,
  useMessageListener,
  useReadListener,
  useGroupEventLogListener,
} from "~/frontend/frontend-2/features/chat/pages/hooks";

import { useAppStore } from "~/frontend/stores/stores";
import { useMembersStore } from "~/frontend/frontend-2/features/chat/pages/stores/members/members.store";
import { useMessagesStore } from "~/frontend/frontend-2/features/chat/pages/stores/messages/messages.store";
import { client } from "~/frontend/external/api-client/client";
import { dexie } from "~/frontend/external/browser/indexed-db";
import { PastGroupChatHeader } from "~/frontend/frontend-2/features/chat/pages/components2/ChatHeader";

const PAGE_SIZE = 24;
const INITIAL_PAGE_SIZE = 64;

export function PastGroupChatPage(props: { contactId: GroupTopicId }) {
  const store = useAppStore((s) => ({
    profile: s.profile,
    pastGrp: s.pastGrp.get(props.contactId),
  }));
  const messagesStore = useMessagesStore();
  const membersStore = useMembersStore();

  const [showDrawer, setShowDrawer] = useState(false);
  const [showMessageImageOverlay, setShowMessageImageOverlay] = useState(false);

  const chatImgViewRef = useRef<HTMLImageElement | null>(null);
  const conversationUIControl = useRef<IChatConversationUI | null>(null);

  const makeMessageListener = useMessageListener(props.contactId, (userId) =>
    membersStore.members.get(userId)
  );
  const makeEventLogListener = useEventLogListener(props.contactId);
  const makeGroupEventLogListener = useGroupEventLogListener(props.contactId, {
    remove: (userId) => membersStore.deleteMember(userId),
    add: (userId, user) => membersStore.setMember(userId, user),
  });
  const makeReadNotificationListener = useReadListener(props.contactId);
  const makeDeleteMessageListener = useDeleteMessageListener(props.contactId);

  useEffect(() => {
    if (conversationUIControl.current === null) {
      return;
    }
    const messageListener = makeMessageListener(conversationUIControl.current);
    const eventLogListener = makeEventLogListener(
      conversationUIControl.current
    );
    const groupEventLogListener = makeGroupEventLogListener();
    const readNotificationListener = makeReadNotificationListener();
    const deleteMessageListener = makeDeleteMessageListener();

    const readListenerId = client.addListener("read", readNotificationListener);
    const messageListenerId = client.addListener("message", messageListener);
    const eventLogListenerId = client.addListener(
      "notification.topic-event",
      eventLogListener
    );
    const deleteMessageListenerId = client.addListener(
      "notification.message-deleted",
      deleteMessageListener
    );
    const groupEventLogListenerId = client.addListener(
      "notification.topic-event",
      groupEventLogListener
    );

    return () => {
      client.removeListener("read", readListenerId);
      client.removeListener("message", messageListenerId);
      client.removeListener("notification.topic-event", eventLogListenerId);
      client.removeListener(
        "notification.message-deleted",
        deleteMessageListenerId
      );
      client.removeListener(
        "notification.topic-event",
        groupEventLogListenerId
      );
    };
  }, [
    makeMessageListener,
    makeEventLogListener,
    makeGroupEventLogListener,
    makeReadNotificationListener,
    makeDeleteMessageListener,
  ]);

  useAsyncEffect(
    async (isMounted) => {
      membersStore.clear();

      const memberRetrievalResult = await client["group/members"]({
        groupTopicId: props.contactId,
      });
      if (memberRetrievalResult.isErr()) {
        alert("failed to get group members");
      } else {
        if (!isMounted) {
          return;
        }

        for (const member of memberRetrievalResult.value) {
          membersStore.setMember(member.id, {
            name: member.fullname,
            online: member.online,
            profilePhotoUrl: member.profilePhotoUrl,
          });
        }
      }

      const result = await messagesStore.loadMessages(INITIAL_PAGE_SIZE, -1);
      if (result.isErr()) {
        return;
      }

      if (!isMounted) {
        return;
      }

      messagesStore.setMessages(result.value.earlierMessages);

      if (messagesStore.get().messages.length !== 0) {
        const messageStatusUpdateResult = await client[
          "topic/update_message_read_status"
        ]({
          sequenceId:
            messagesStore.get().messages[
              messagesStore.get().messages.length - 1
            ].seqId,
          topicId: props.contactId,
        });

        if (!isMounted) {
          return;
        }

        if (messageStatusUpdateResult.isErr()) {
          alert(
            `Failed to update read message id ` +
              messageStatusUpdateResult.error.message
          );
        }

        const userId = store.profile.profile?.userId;
        if (userId === undefined) {
          throw new Error(`UserId is undefined`);
        }

        const idbUpdateResult = await fromPromise(
          dexie.messages
            .where("topicId")
            .equals(props.contactId)
            .and((x) => !(x.author == userId))
            .modify({ read: true }),
          (e) => e
        );
        if (idbUpdateResult.isErr()) {
          console.error(idbUpdateResult.error);
        }
      }

      conversationUIControl.current?.scrollChatToTheBottom();
      conversationUIControl.current?.updateFirstMessageRef();
    },
    [
      membersStore.clear,
      messagesStore.loadMessages,
      messagesStore.get,
      props.contactId,
      store.profile.profile?.userId,
    ]
  );

  if (store.pastGrp === undefined) {
    throw new Error(`Group is undefined`);
  }

  const user = store.profile.profile;

  if (user === null) {
    throw new Error(`User profile is undefined`);
  }

  const pastGrpMemberList = useMemo(() => {
    const memberArr = store.pastGrp?.profile.memberList ?? [];
    const memberList = new Map<
      UserId,
      {
        name: string;
        profilePhotoUrl: string | null;
      }
    >();
    for (const m of memberArr) {
      memberList.set(m.userId, {
        name: m.name,
        profilePhotoUrl: m.profilePhotoUrl,
      });
    }

    return memberList;
  }, [store.pastGrp.profile.memberList]);

  const getAuthorProfileImage = useCallback(
    (userId: UserId) => {
      return pastGrpMemberList.get(userId)?.profilePhotoUrl ?? undefined;
    },
    [pastGrpMemberList]
  );

  return (
    <div className="relative h-screen">
      <PastGroupChatHeader
        groupName={store.pastGrp.profile.name}
        onInfoClick={() => setShowDrawer(false)}
        groupProfilePhotoUrl={
          store.pastGrp.profile.profilePhotoUrl ?? undefined
        }
      />

      <div className="relative h-[calc(100%-4rem)] w-full">
        <ChatConversation
          isNewContact={false}
          peerName={store.pastGrp.profile.name}
          ref={conversationUIControl}
          onChatScrollToTop={async () => {
            if (
              messagesStore.hasEarlierMessages &&
              !messagesStore.isLoadingMoreMessages
            ) {
              await messagesStore.loadMessages(
                PAGE_SIZE,
                messagesStore.messages[0].seqId
              );
              return "new messages loaded";
            }
            return "no new messages loaded";
          }}
          onMessageBubbleMenuClick={() => {
            //
          }}
          getAuthorProfileImage={getAuthorProfileImage}
          chatItems={messagesStore.messages}
          mode={{ type: "removed from group" }}
          onMessageImageClick={async (messageUrl) => {
            if (chatImgViewRef.current) {
              chatImgViewRef.current.src = messageUrl;
            }

            await new Promise((resolve) => {
              setTimeout(() => {
                resolve(undefined);
              }, 200);
            });

            setShowMessageImageOverlay(true);
          }}
          onReplyMessage={() => {
            //
          }}
          toReplyMessage={null}
          showReplyPreview={false}
          onCloseReplyPreview={() => {
            //
          }}
        />
      </div>
    </div>
  );
}

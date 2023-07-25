import { useState, useEffect, useRef } from "react";
import { fromPromise } from "neverthrow";
import type {
  GroupTopicId,
  UserId,
} from "~/api-contract/subscription/subscription";
import clsx from "clsx";

import { ChatConversation } from "~/frontend/features/chat/pages/components/ChatConversation/ChatConversation";
import { ChatImageOverlay } from "~/frontend/features/chat/pages/components/ChatOverlays";
import { ChatHeader } from "~/frontend/features/chat/pages/components/PastGroupChat";
import type {
  IChatUI,
  IChatConversationUI,
} from "~/frontend/features/chat/pages/types";
import {
  useDeleteMessageListener,
  useEventLogListener,
  useMessageListener,
  useReadListener,
  useGroupEventLogListener,
} from "~/frontend/features/chat/pages/hooks";

import { useAppStore } from "~/frontend/stores/stores";
import { useMembersStore } from "~/frontend/features/chat/pages/stores/members/members.store";
import { useMessagesStore } from "~/frontend/features/chat/pages/stores/messages/messages.store";
import { client } from "~/frontend/external/api-client/client";
import { dexie } from "~/frontend/external/browser/indexed-db";

const PAGE_SIZE = 24;
const INITIAL_PAGE_SIZE = 64;

export function PastGroupChatPage(props: { contactId: GroupTopicId }) {
  const store = useAppStore((s) => ({
    profile: s.profile,
    pastGrp: s.pastGrp,
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

  useEffect(() => {
    const loadMessages = async () => {
      membersStore.clear();

      const memberRetrievalResult = await client["group/members"]({
        groupTopicId: props.contactId,
      });
      if (memberRetrievalResult.isErr()) {
        alert("failed to get group members");
      } else {
        for (const member of memberRetrievalResult.value) {
          membersStore.setMember(member.id, {
            name: member.fullname,
            online: member.online,
            profilePhotoUrl: member.profilePhotoUrl,
          });
        }
      }

      await messagesStore.loadMessages(INITIAL_PAGE_SIZE, -1);

      if (messagesStore.messages.length !== 0) {
        const messageStatusUpdateResult = await client[
          "topic/update_message_read_status"
        ]({
          sequenceId:
            messagesStore.messages[messagesStore.messages.length - 1].seqId,
          topicId: props.contactId,
        });

        if (messageStatusUpdateResult.isErr()) {
          alert(
            `Failed to update read message id ` +
              messageStatusUpdateResult.error.message
          );
        }

        const userId = store.profile?.userId;
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
    };

    void loadMessages();
  }, [membersStore, messagesStore, props.contactId, store.profile?.userId]);

  const grp = store.pastGrp.get(props.contactId);

  if (grp === undefined) {
    throw new Error(`Group is undefined`);
  }

  const user = store.profile;

  if (user === undefined) {
    throw new Error(`User profile is undefined`);
  }

  return (
    <div className="flex h-screen">
      <div className="h-full flex-grow">
        <ChatHeader
          name={grp.profile.name}
          onInfoClick={() => setShowDrawer(false)}
          profilePhotoUrl={grp.profile.profilePhotoUrl}
        />
      </div>

      <div className="h-[calc(100vh-3.5rem)]">
        <ChatConversation
          isNewContact={false}
          peerName={grp.profile.name}
          userId={user.userId}
          mode={{ type: "removed from group" }}
          ref={conversationUIControl}
          messages={messagesStore.messages}
          onMessageBubbleMenuClick={() => {
            //
          }}
          onReplyMessageClick={() => {
            //
          }}
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
        />

        <div
          className={clsx(
            "absolute left-0 top-0 h-[calc(100%)] w-full bg-white",
            {
              hidden: !showMessageImageOverlay,
            }
          )}
        >
          <ChatImageOverlay
            ref={chatImgViewRef}
            onCloseOverlay={() => setShowMessageImageOverlay(false)}
          />
        </div>
      </div>
    </div>
  );
}

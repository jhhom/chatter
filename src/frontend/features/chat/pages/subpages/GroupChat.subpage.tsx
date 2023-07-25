import { useState, useRef, useEffect, useCallback } from "react";
import { toast, Toaster } from "react-hot-toast";
import { Result, ok, err, fromPromise } from "neverthrow";
import { useRouter } from "next/router";

import { UserId, GroupTopicId } from "~/api-contract/subscription/subscription";
import { permission } from "~/backend/service/common/permissions";

import {
  ChatConversationProps,
  IChatConversationUI,
} from "~/frontend/features/chat/pages/types";
import {
  ChatMessageType,
  ChatMessageTypeMessage,
} from "~/frontend/features/chat/pages/stores/messages/get-messages-display-sequences";
import { ChatConversation } from "~/frontend/features/chat/pages/components/ChatConversation/ChatConversation";
import {
  ChatHeader,
  ChatHeaderProps,
} from "~/frontend/features/chat/pages/components/ChatHeader";
import { ChatTextInput } from "~/frontend/features/chat/pages/components/ChatTextInput/ChatTextInput";
import { GroupInfoDrawer } from "~/frontend/features/chat/pages/components/ChatInfoDrawer";
import { GroupInfo } from "~/frontend/features/chat/pages/components/ChatInfoDrawer";
import { GroupAddMember } from "~/frontend/features/chat/pages/components/ChatInfoDrawer";
import { GroupSecurityContent } from "~/frontend/features/chat/pages/components/ChatInfoDrawer";
import {
  ChatReplyPreview,
  ChatReplyPreviewProps,
} from "~/frontend/features/chat/pages/components/ChatReplyPreview";
import {
  ChatMessageBubbleMenu,
  ChatMessageBubbleMenuItem,
} from "~/frontend/features/chat/pages/components/ChatConversation/ChatMessageBubbleMenu";
import {
  ChatFileUploadPreviewOverlay,
  ChatImageUploadPreviewOverlay,
  ChatImageOverlay,
  ForwardMessageOverlay,
  DeleteMessageOverlay,
} from "~/frontend/features/chat/pages/components/ChatOverlays";
import type {
  ChatInputMode,
  ChatTextInputProps,
} from "~/frontend/features/chat/pages/components/ChatTextInput/ChatTextInput";
import { GroupInviteLinkInfo } from "~/frontend/features/chat/pages/components/ChatInfoDrawer";
import { GroupMemberSecurityContent } from "~/frontend/features/chat/pages/components/ChatInfoDrawer";

import { useAppStore } from "~/frontend/stores/stores";
import { client } from "~/frontend/external/api-client/client";
import { dexie } from "~/frontend/external/browser/indexed-db";

import { GrpContactProfile } from "~/frontend/stores/contact-status.store";
import { useMessagesStore } from "~/frontend/features/chat/pages/stores/messages/messages.store";
import { useMembersStore } from "~/frontend/features/chat/pages/stores/members/members.store";
import {
  useDeleteMessageListener,
  useEventLogListener,
  useGroupEventLogListener,
  useMessageListener,
  useReadListener,
} from "~/frontend/features/chat/pages/hooks";

const PAGE_SIZE = 24;
const INITIAL_PAGE_SIZE = 64;

export function GroupChatPage(props: { contactId: GroupTopicId }) {
  const store = useAppStore((s) => ({
    profile: s.profile,
    grp: s.grp,
    p2p: s.p2p,
  }));
  const messagesStore = useMessagesStore();
  const membersStore = useMembersStore();

  const [showDrawer, setShowDrawer] = useState(false);
  const [showMessageImageOverlay, setShowMessageImageOverlay] = useState(false);
  const [showForwardMessageOverlay, setShowForwardMessageOverlay] =
    useState(false);
  const [showDeleteMessageOverlay, setShowDeleteMessageOverlay] =
    useState(false);
  const [inputMode, setInputMode] = useState<ChatInputMode>({
    type: "message",
  });
  const [showMessageBubbleMenu, setShowMessageBubbleMenu] = useState(false);
  const [toReplyMessage, setToReplyMessage] = useState(false);
  const [messageSelected, setMessageSelected] =
    useState<ChatMessageTypeMessage | null>(null);

  const router = useRouter();

  const conversationUIControl = useRef<IChatConversationUI | null>(null);
  const imgUploadPreviewRef = useRef<HTMLImageElement | null>(null);
  const chatImgViewRef = useRef<HTMLImageElement | null>(null);
  const messageBubbleMenuRef = useRef<HTMLDivElement | null>(null);
  const conversationContainerRef = useRef<HTMLDivElement | null>(null);
  const chatReplyPreviewRef = useRef<HTMLDivElement | null>(null);

  const grp = store.grp.get(props.contactId);

  if (grp === undefined) {
    throw new Error("Group not found");
  }

  const conversationDisplayMode: Parameters<
    typeof ChatConversation
  >[0]["mode"] = (() => {
    const user = permission(grp.profile.userPermissions);

    if (!user.canRead()) {
      return { type: "read disabled" };
    } else if (!user.canWrite()) {
      return { type: "write disabled" };
    } else {
      return { type: "normal" };
    }
  })();

  const makeMessageListener = useMessageListener(
    props.contactId,
    (userId: UserId) => membersStore.members.get(userId)
  );
  const makeEventLogListener = useEventLogListener(props.contactId);
  const makeGroupEventLogListener = useGroupEventLogListener(props.contactId, {
    remove: (userId) => membersStore.members.delete(userId),
    add: (userId, user) => membersStore.members.set(userId, user),
  });
  const makeReadNotificationListener = useReadListener(props.contactId);
  const makeDeleteMessageListener = useDeleteMessageListener(props.contactId);

  useEffect(() => {
    if (conversationUIControl.current === null) {
      return;
    }
    const messageListener = makeMessageListener(conversationUIControl.current);
    const readListener = makeReadNotificationListener();
    const eventLogListener = makeEventLogListener(
      conversationUIControl.current
    );
    const groupEventLogListener = makeGroupEventLogListener();
    const deleteMessageListener = makeDeleteMessageListener();

    const readListenerId = client.addListener("read", readListener);
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const loadMessagesOfTopic = async () => {
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

    void loadMessagesOfTopic();
  }, [props.contactId, membersStore, messagesStore, store.profile?.userId]);

  const onClearMessages: ChatHeaderProps["onClearMessages"] =
    useCallback(async () => {
      const r = await client["topic/clear_messages"]({
        topicId: props.contactId,
      });
      if (r.isErr()) {
        return;
      }
      try {
        await dexie.messages
          .where("topicId")
          .equals(props.contactId)
          .delete()
          .then(() => {
            return dexie.topicEventLogs
              .where("topicId")
              .equals(props.contactId)
              .delete();
          })
          .catch((e) =>
            alert(
              `An unexpected error had occured when clearing local messages cache`
            )
          );
      } catch {}

      messagesStore.clearMessages();

      const c = store.grp.get(props.contactId);
      if (c) {
        store.grp.set(props.contactId, {
          profile: {
            ...c.profile,
            lastMessage: null,
          },
          status: c.status,
        });
      }
    }, [props.contactId, messagesStore, store.grp]);

  const onChatScrollToTop: ChatConversationProps["onChatScrollToTop"] =
    useCallback(async () => {
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
    }, [messagesStore]);

  const onReplyMessageClick: ChatConversationProps["onReplyMessageClick"] =
    useCallback(
      async (seqId) => {
        const hasMessageInDisplay =
          messagesStore.messages.findIndex((x) => x.seqId === seqId) !== -1;
        if (hasMessageInDisplay) {
          conversationUIControl.current?.scrollToMessage(seqId);
          return;
        }

        const hasMessagesBeforeReplyInDisplay =
          messagesStore.messages.findIndex((x) => x.seqId < seqId) !== -1;
        if (hasMessagesBeforeReplyInDisplay) {
          toast("Message not found");
          return;
        }

        const result = await messagesStore.loadMessagesUntilReply(
          messagesStore.messages[0].seqId,
          seqId
        );
        if (result.isErr()) {
          if (result.error.type === "message not found") {
            toast("Message not found");
            return;
          } else {
            console.error(
              `Unexpected error in getting replied message:`,
              result.error.cause
            );
            return;
          }
        } else {
          conversationUIControl.current?.scrollToMessage(seqId);
        }
      },
      [messagesStore]
    );

  const onMessageBubbleMenuClick: ChatConversationProps["onMessageBubbleMenuClick"] =
    useCallback(
      (e, message) => {
        if (!showMessageBubbleMenu && messageBubbleMenuRef.current) {
          messageBubbleMenuRef.current.style.setProperty(
            "--mouse-x",
            `${e.clientX}px`
          );
          messageBubbleMenuRef.current.style.setProperty(
            "--mouse-y",
            `${e.clientY}px`
          );
        }
        setShowMessageBubbleMenu(true);
        setMessageSelected(message);
      },
      [showMessageBubbleMenu]
    );

  const onMessageImageClick: ChatConversationProps["onMessageImageClick"] =
    useCallback(async (messageUrl) => {
      if (chatImgViewRef.current) {
        chatImgViewRef.current.src = messageUrl;
      }

      await new Promise((resolve) => {
        setTimeout(() => {
          resolve(undefined);
        }, 200);
      });

      setShowMessageImageOverlay(true);
    }, []);

  const onCloseReplyPreview: ChatReplyPreviewProps["onClose"] =
    useCallback(async () => {
      if (conversationContainerRef.current) {
        conversationContainerRef.current.style.transform = `translateY(0%)`;
      }
      // await animations to finish
      // before we completely hide the preview
      await new Promise((r) => setTimeout(() => r(undefined), 250));
      setToReplyMessage(false);
    }, []);

  const onMessageSubmit: ChatTextInputProps["onMessageSubmit"] = useCallback(
    async (message) => {
      if (toReplyMessage) {
        const replyTo = messageSelected;
        if (replyTo == null) {
          return;
        }

        const result = await client["topic/reply_message"]({
          content: message,
          receiverId: props.contactId,
          replyToMessageSeqId: replyTo.seqId,
        });

        if (result.isOk()) {
          conversationUIControl.current?.scrollChatToTheBottom();
        }
        if (conversationContainerRef.current) {
          conversationContainerRef.current.style.transform = `translateY(0%)`;
        }
        // await animations to finish
        // before we completely hide the preview
        await new Promise((r) => setTimeout(() => r(undefined), 250));
        setToReplyMessage(false);
      } else {
        const result = await client["topic/send_message"]({
          content: message,
          receiverUserId: props.contactId,
        });
        if (result.isOk()) {
          conversationUIControl.current?.scrollChatToTheBottom();
        }
      }
      setInputMode({ type: "message" });
    },
    [messageSelected, props.contactId, toReplyMessage]
  );

  const onTyping: ChatTextInputProps["onTyping"] = useCallback(
    (isTyping) => {
      void client["topic/notify_typing"]({
        action: isTyping ? "typing" : "stop-typing",
        contactUserId: props.contactId,
      });
    },
    [props.contactId]
  );

  const onLoadFile: ChatTextInputProps["onLoadFile"] = useCallback((file) => {
    setInputMode({
      type: "file",
      filename: file.name,
      contentType: file.type,
      size: file.size,
    });
  }, []);

  const onLoadPhoto: ChatTextInputProps["onLoadPhoto"] = useCallback(
    async (photo) => {
      if (imgUploadPreviewRef.current) {
        imgUploadPreviewRef.current.src = URL.createObjectURL(photo);
      }

      await new Promise((resolve) => {
        setTimeout(() => {
          resolve(undefined);
        }, 200);
      });
      setInputMode({ type: "photo", filename: photo.name });
    },
    []
  );

  return (
    <div className="relative flex h-screen">
      <div className="h-full flex-grow">
        <ChatHeader
          type="group"
          name={grp.profile.name}
          online={grp.status.online}
          lastSeen={null}
          typing={
            grp.status.online && grp.status.latestTyping !== null
              ? grp.status.latestTyping.fullname
              : null
          }
          profilePhotoUrl={grp.profile.profilePhotoUrl}
          onInfoClick={() => setShowDrawer(true)}
          onClearMessages={onClearMessages}
        />

        <div class="relative h-[calc(100vh-3rem-3.5rem)] overflow-hidden">
          <div
            ref={conversationContainerRef}
            class="absolute top-0 h-full w-full transition-transform duration-200"
          >
            <ChatConversation
              ref={conversationUIControl}
              isNewContact={false}
              peerName={grp.profile.name}
              userId={grp.profile.ownerId}
              mode={conversationDisplayMode}
              messages={messagesStore.messages}
              onChatScrollToTop={onChatScrollToTop}
              onReplyMessageClick={onReplyMessageClick}
              onMessageBubbleMenuClick={onMessageBubbleMenuClick}
              onMessageImageClick={onMessageImageClick}
            />
            <div
              ref={chatReplyPreviewRef}
              class="w-full items-center bg-blue-500 text-white"
            >
              {messageSelected !== null && toReplyMessage && (
                <ChatReplyPreview
                  messageReplied={messageSelected}
                  onClose={onCloseReplyPreview}
                />
              )}
            </div>
          </div>
        </div>

        <ChatTextInput
          inputMode={inputMode}
          disabled={conversationDisplayMode.type !== "normal"}
          onMessageSubmit={onMessageSubmit}
          onLoadFile={onLoadFile}
          onLoadPhoto={onLoadPhoto}
          onTyping={onTyping}
        />
      </div>

      {
        showDrawer && (
          
        )
      }
    </div>
  );
}

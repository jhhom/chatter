import { useState, useRef, useEffect, useCallback } from "react";
import { toast, Toaster } from "react-hot-toast";
import { ok, err, fromPromise } from "neverthrow";
import { useRouter } from "next/navigation";
import clsx from "clsx";

import type {
  UserId,
  GroupTopicId,
} from "~/api-contract/subscription/subscription";
import { permission } from "~/backend/service/common/permissions";

import type {
  ChatConversationProps,
  IChatConversationUI,
} from "~/frontend/frontend-2/features/chat/pages/types";
import type { ChatMessageTypeMessage } from "~/frontend/frontend-2/features/chat/pages/components/ChatConversation/ChatMessage";
import { ChatConversation } from "~/frontend/frontend-2/features/chat/pages/components/ChatConversation/ChatConversation";
import {
  ChatHeader,
  type ChatHeaderProps,
} from "~/frontend/frontend-2/features/chat/pages/components/ChatHeader";
import { ChatTextInput } from "~/frontend/frontend-2/features/chat/pages/components/ChatTextInput/ChatTextInput";

import { GroupInfoDrawer } from "~/frontend/frontend-2/features/chat/pages/components/ChatDrawer";
import { GroupInfo } from "~/frontend/frontend-2/features/chat/pages/components/ChatDrawer/GroupInfoDrawer/GroupInfo";
import { GroupAddMember } from "~/frontend/frontend-2/features/chat/pages/components/ChatDrawer/GroupInfoDrawer/GroupAddMember";
import { GroupSecurityContent } from "~/frontend/frontend-2/features/chat/pages/components/ChatDrawer/GroupInfoDrawer/GroupSecurityContent";
import {
  ChatReplyPreview,
  type ChatReplyPreviewProps,
} from "~/frontend/frontend-2/features/chat/pages/components/ChatReplyPreview";
import {
  ChatFileUploadPreviewOverlay,
  ChatImageUploadPreviewOverlay,
  ChatImageOverlay,
  ForwardMessageOverlay,
  DeleteMessageOverlay,
} from "~/frontend/frontend-2/features/chat/pages/components/ChatOverlays";
import type {
  ChatInputMode,
  ChatTextInputProps,
} from "~/frontend/frontend-2/features/chat/pages/components/ChatTextInput/ChatTextInput";
import {
  ChatMessageBubbleMenu,
  ChatMessageBubbleMenuItem,
} from "~/frontend/frontend-2/features/chat/pages/components/ChatConversation/ChatMessageBubbleMenu";
import { GroupInviteLinkInfo } from "~/frontend/frontend-2/features/chat/pages/components/ChatDrawer/GroupInfoDrawer/GroupInviteLinkInfo";
import { GroupMemberSecurityContent } from "~/frontend/frontend-2/features/chat/pages/components/ChatDrawer/GroupInfoDrawer/GroupMemberSecurityContent";

import { useAppStore } from "~/frontend/stores/stores";
import { client } from "~/frontend/external/api-client/client";
import { dexie } from "~/frontend/external/browser/indexed-db";

import { useMessagesStore } from "~/frontend/frontend-2/features/chat/pages/stores/messages/messages.store";
import { useMembersStore } from "~/frontend/frontend-2/features/chat/pages/stores/members/members.store";
import {
  useGroupEventLogListener,
  useDeleteMessageListener,
  useEventLogListener,
  useMessageListener,
  useReadListener,
} from "~/frontend/frontend-2/features/chat/pages/hooks";

import { userGroupConversationDisplayMode } from "~/frontend/frontend-2/features/chat/utils";
import { match } from "ts-pattern";
import useAsyncEffect from "use-async-effect";

const PAGE_SIZE = 24;
const INITIAL_PAGE_SIZE = 64;

export function GroupChatPage(props: { contactId: GroupTopicId }) {
  const store = useAppStore((s) => ({
    profile: s.profile,
    grp: s.grp.get(props.contactId),
    groupList: s.grp.entries(),
    p2pList: s.p2p.entries(),
    get: s.get,
    setContact: s.setContact,
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

  if (store.grp === undefined) {
    throw new Error("Group not found");
  }

  if (store.profile === undefined) {
    throw new Error("User profile is undefined");
  }

  const conversationDisplayMode: Parameters<
    typeof ChatConversation
  >[0]["mode"] = userGroupConversationDisplayMode(
    store.grp.profile.userPermissions
  );

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
  }, [
    makeMessageListener,
    makeReadNotificationListener,
    makeEventLogListener,
    makeGroupEventLogListener,
    makeDeleteMessageListener,
  ]);

  useAsyncEffect(
    async (isMounted) => {
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

        if (messageStatusUpdateResult.isErr()) {
          alert(
            `Failed to update read message id ` +
              messageStatusUpdateResult.error.message
          );
        }

        if (!isMounted) {
          return;
        }

        const userId = store.get().profile.profile?.userId;
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

        if (!isMounted) {
          return;
        }
      }

      conversationUIControl.current?.scrollChatToTheBottom();
      conversationUIControl.current?.updateFirstMessageRef();
    },
    () => {
      // cleanup
    },
    [props.contactId, store.get]
  );

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

      const c = store.get().grp.get(props.contactId);
      if (c) {
        store.setContact((s) => {
          s.grp.set(props.contactId, {
            profile: {
              ...c.profile,
              lastMessage: null,
            },
            status: c.status,
          });
        });
      }
    }, [
      props.contactId,
      messagesStore.clearMessages,
      store.get,
      store.setContact,
    ]);

  const onChatScrollToTop: ChatConversationProps["onChatScrollToTop"] =
    useCallback(async () => {
      if (
        messagesStore.get().hasEarlierMessages &&
        !messagesStore.get().isLoadingMoreMessages
      ) {
        const result = await messagesStore.loadMessages(
          PAGE_SIZE,
          messagesStore.get().messages[0].seqId
        );
        if (result.isOk()) {
          messagesStore.setMessages(
            result.value.earlierMessages.concat(messagesStore.get().messages)
          );
        }
        return "new messages loaded";
      }

      return "no new messages loaded";
    }, [messagesStore.get, messagesStore.loadMessages]);

  const onReplyMessageClick: ChatConversationProps["onReplyMessageClick"] =
    useCallback(
      async (seqId) => {
        const hasMessageInDisplay =
          messagesStore.get().messages.findIndex((x) => x.seqId === seqId) !==
          -1;
        if (hasMessageInDisplay) {
          conversationUIControl.current?.scrollToMessage(seqId);
          return;
        }

        const hasMessagesBeforeReplyInDisplay =
          messagesStore.get().messages.findIndex((x) => x.seqId < seqId) !== -1;
        if (hasMessagesBeforeReplyInDisplay) {
          toast("Message not found");
          return;
        }

        const result = await messagesStore.loadMessagesUntilReply(
          messagesStore.get().messages[0].seqId,
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
      [messagesStore.get, messagesStore.loadMessagesUntilReply]
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

  return <div className="relative flex h-screen"></div>;
}

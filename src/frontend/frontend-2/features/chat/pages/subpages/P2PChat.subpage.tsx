import React, {
  useRef,
  useState,
  useCallback,
  useEffect,
  ComponentProps,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fromPromise } from "neverthrow";
import { toast, Toaster } from "react-hot-toast";

import type { UserId } from "~/api-contract/subscription/subscription";

import type { ChatTextInputProps } from "~/frontend/frontend-2/features/chat/pages/components/ChatTextInput/ChatTextInput";
import type {
  ChatConversationProps,
  IChatConversationUI,
} from "~/frontend/frontend-2/features/chat/pages/types";

import { type SecurityContentProps } from "~/frontend/frontend-2/features/chat/pages/components/ChatDrawer/P2PInfoDrawer";
import { type DeleteMessageOverlayProps } from "~/frontend/frontend-2/features/chat/pages/components/ChatOverlays";
import {
  ChatTextInput as ChatTextInputComponent,
  type ChatInputMode,
} from "~/frontend/frontend-2/features/chat/pages/components/ChatTextInput/ChatTextInput";
import { type ChatReplyPreviewProps } from "~/frontend/frontend-2/features/chat/pages/components/ChatReplyPreview";
import type { ChatMessageTypeMessage } from "~/frontend/frontend-2/features/chat/pages/components/ChatConversation/ChatMessage";

import { permission } from "~/backend/service/common/permissions";
import { ChatConversation } from "~/frontend/frontend-2/features/chat/pages/components2/ChatConversation/ChatConversation";
import { ChatHeader } from "~/frontend/frontend-2/features/chat/pages/components2/ChatHeader";
import {
  ChatFileUploadPreviewOverlay,
  ForwardMessageOverlay,
  ChatImageUploadPreviewOverlay,
  DeleteMessageOverlay,
} from "~/frontend/frontend-2/features/chat/pages/components2/ChatOverlays";
import {
  ChatMessageBubbleMenu,
  ChatMessageBubbleMenuItem,
} from "~/frontend/frontend-2/features/chat/pages/components2/ChatConversation/ChatMessageBubbleMenu";
import { TextInput } from "~/frontend/frontend-2/features/chat/pages/components2/TextInput/TextInput";
import { P2PInfoDrawer } from "~/frontend/frontend-2/features/chat/pages/components2/Drawers/P2PInfoDrawer";

import {
  useMessageListener,
  useDeleteMessageListener,
  useReadListener,
} from "~/frontend/frontend-2/features/chat/pages/hooks";

import { dexie } from "~/frontend/external/browser/indexed-db";
import { client } from "~/frontend/external/api-client/client";
import { useAppStore } from "~/frontend/stores/stores";
import { useMessagesStore } from "~/frontend/frontend-2/features/chat/pages/stores/messages/messages.store";

import { clsx as cx } from "clsx";
import useAsyncEffect from "use-async-effect";
import { userPeerConversationDisplayMode } from "../../utils";

export type IChatUI = Pick<
  IChatConversationUI,
  "isUserAtTheBottomOfScroll" | "scrollChatToTheBottom"
>;

const PAGE_SIZE = 24;
const INITIAL_PAGE_SIZE = 64;

export function P2PChatPage(props: { contactId: UserId }) {
  const store = useAppStore((s) => ({
    profile: s.profile,
    p2p: s.p2p,
    grp: s.grp,
    newContacts: s.newContacts,
    get: s.get,
    setContact: s.setContact,
  }));
  const messagesStore = useMessagesStore();

  const messageBubbleMenuRef = useRef<HTMLDivElement | null>(null);
  const chatImgViewRef = useRef<HTMLImageElement | null>(null);
  const imgUploadPreviewRef = useRef<HTMLImageElement | null>(null);
  const conversationUIControl = useRef<IChatConversationUI>({
    updateFirstMessageRef() {
      return;
    },
    isUserAtTheBottomOfScroll() {
      return false;
    },
    scrollChatToTheBottom() {
      return;
    },
    scrollToMessage(seqId) {
      return;
    },
  });

  const [showDrawer, setShowDrawer] = useState(false);
  const [showForwardMessageOverlay, setShowForwardMessageOverlay] =
    useState(false);
  const [showMessageBubbleMenu, setShowMessageBubbleMenu] = useState(false);
  const [toReplyMessage, setToReplyMessage] = useState(false);
  const [showUnblockModal, setShowUnblockModal] = useState(false);
  const [showDeleteMessageOverlay, setShowDeleteMessageOverlay] =
    useState(false);
  const [showMessageImageOverlay, setShowMessageImageOverlay] = useState(false);
  const [messageSelected, setMessageSelected] =
    useState<ChatMessageTypeMessage | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();

  const [inputMode, setInputMode] = useState<ChatInputMode>({
    type: "message",
  });

  const makeMessageListener = useMessageListener(props.contactId, (userId) => {
    if (userId === props.contactId) {
      const profile = store.get().p2p.get(props.contactId);
      if (profile === undefined) {
        return undefined;
      }
      return {
        name: profile.profile.name,
        online: profile.status.online,
      };
    }
    const userProfile = store.get().profile.profile;
    if (userProfile === null) {
      return undefined;
    }
    return {
      name: userProfile.fullname,
      online: true,
    };
  });

  const makeDeleteMessageListener = useDeleteMessageListener(props.contactId);
  const makeReadListener = useReadListener(props.contactId);

  const onBlock = useCallback(async () => {
    const r = await client["permissions/block_peer"]({
      peerId: props.contactId,
    });
    if (r.isErr()) {
      alert(`Failed to block peer: ${r.error.message}`);
      return;
    }
  }, [props.contactId]);

  const onClearMessages = useCallback(async () => {
    const r = await client["topic/clear_messages"]({
      topicId: props.contactId,
    });
    if (r.isErr()) {
      alert(`An expected error has occured when clearing the messages`);
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
    // TODO: chat.clearMessages();

    const c = store.get().p2p.get(props.contactId);
    if (c) {
      store.setContact((s) => {
        s.p2p.set(props.contactId, {
          profile: {
            ...c.profile,
            lastMessage: null,
          },
          status: c.status,
        });
      });
    }
  }, [store.get, store.setContact, props.contactId]);

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
          messagesStore.get().messages.findIndex((x) => x.seqId === seqId) !=
          -1;

        if (hasMessageInDisplay) {
          conversationUIControl.current.scrollToMessage(seqId);
          return;
        }

        const hasMessagesBeforeReplyInDisplay =
          messagesStore.get().messages.findIndex((x) => x.seqId < seqId) != -1;
        if (hasMessagesBeforeReplyInDisplay) {
          // if in our display, we have messages earlier than the reply message
          // but it's not found in our store
          // that means that the message has been deleted before
          toast("Message not found");
          return;
        }

        const result = await messagesStore.loadMessagesUntilReply(
          messagesStore.get().messages[0].seqId,
          seqId
        );
        if (result.isErr()) {
          if (result.error.type == "message not found") {
            toast("Message not found");
            return;
          } else {
            console.error(
              `Unknown error in getting replied message`,
              result.error.cause
            );
            return;
          }
        } else {
          conversationUIControl.current.scrollToMessage(seqId);
          return;
        }
      },
      [messagesStore.get, messagesStore.loadMessagesUntilReply]
    );

  const onMessageBubbleMenuClick: ChatConversationProps["onMessageBubbleMenuClick"] =
    useCallback(
      (e, message) => {
        console.log("SHOW MESSAEG BUBBLE MENU", showMessageBubbleMenu);
        if (!showMessageBubbleMenu) {
          messageBubbleMenuRef.current?.style.setProperty(
            "--mouse-x",
            `${e.clientX}px`
          );
          messageBubbleMenuRef.current?.style.setProperty(
            "--mouse-y",
            `${e.clientY}px`
          );
          setMessageSelected(message);
          setShowMessageBubbleMenu(true);
        } else {
          console.log("SHOW MESSAGE BUBBLM MENU");
          setMessageSelected(null);
          setShowMessageBubbleMenu(false);
        }
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
    useCallback(() => {
      setToReplyMessage(false);
      setMessageSelected(null);
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
          conversationUIControl.current.scrollChatToTheBottom();
        }
        setToReplyMessage(false);
        setMessageSelected(null);
      } else {
        const result = await client["topic/send_message"]({
          content: message,
          receiverUserId: props.contactId,
        });
        if (result.isOk()) {
          conversationUIControl.current.scrollChatToTheBottom();
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
    [setInputMode]
  );

  const onSubmitPermissionChange: (
    onSubmissionSuccess: () => void
  ) => SecurityContentProps["onSubmitPermissionChange"] = useCallback(
    (onSubmissionSuccess) => {
      const onSubmitPermission: SecurityContentProps["onSubmitPermissionChange"] =
        async (permission) => {
          const r = await client["permissions/update_peer_permission"]({
            newPermission: permission,
            peerId: props.contactId,
          });
          if (r.isErr()) {
            alert("Failed to update peer's permission: " + r.error.message);
            return { result: "update failed" } as const;
          } else {
            onSubmissionSuccess();
            return {
              newPermission: r.value.permissions,
              result: "update successful",
            } as const;
          }
        };

      return onSubmitPermission;
    },
    [props.contactId]
  );

  const onDeleteForEveryone: DeleteMessageOverlayProps["onDeleteForEveryone"] =
    useCallback(async () => {
      if (!messageSelected?.userIsAuthor) {
        return;
      }

      setShowDeleteMessageOverlay(false);
      const message = messageSelected;
      if (message === null) {
        throw new Error("No message is selected for deletion");
      }
      const r = await client["topic/delete_message"]({
        topicId: props.contactId,
        messageSeqId: message.seqId,
        deleteFor: "everyone",
      });
      if (r.isErr()) {
        alert(`Failed to delete message: ${r.error.message}`);
        return;
      }
    }, [messageSelected, props.contactId]);

  const onDeleteForMe: DeleteMessageOverlayProps["onDeleteForMe"] =
    useCallback(async () => {
      setShowDeleteMessageOverlay(false);
      const message = messageSelected;
      if (message === null) {
        throw new Error("No message is selected for deletion");
      }
      const r = await client["topic/delete_message"]({
        topicId: props.contactId,
        messageSeqId: message.seqId,
        deleteFor: "self",
      });
      if (r.isErr()) {
        alert(`Failed to delete message: ${r.error.message}`);
        return;
      }
    }, [messageSelected, props.contactId]);

  useEffect(() => {
    const messageListener = makeMessageListener(conversationUIControl.current);
    const readNotificationListener = makeReadListener();
    const deleteMessageListener = makeDeleteMessageListener();

    const messageListenerId = client.addListener("message", messageListener);
    const messageFromNewTopicListenerId = client.addListener(
      "message.from-new-topic",
      messageListener
    );
    const readNotificationListenerId = client.addListener(
      "read",
      readNotificationListener
    );
    const deleteMessageListenerId = client.addListener(
      "notification.message-deleted",
      deleteMessageListener
    );

    return () => {
      client.removeListener("message", messageListenerId);
      client.removeListener(
        "message.from-new-topic",
        messageFromNewTopicListenerId
      );
      client.removeListener("read", readNotificationListenerId);
      client.removeListener(
        "notification.message-deleted",
        deleteMessageListenerId
      );
    };
  }, [makeMessageListener, makeReadListener, makeDeleteMessageListener]);

  useAsyncEffect(
    async (isMounted) => {
      const result = await messagesStore.loadMessages(INITIAL_PAGE_SIZE, -1);

      if (!isMounted) {
        return;
      }

      if (result.isErr()) {
        return;
      }

      messagesStore.setMessages(result.value.earlierMessages);

      if (messagesStore.get().messages.length != 0) {
        const updateResult = await client["topic/update_message_read_status"]({
          sequenceId:
            messagesStore.get().messages[
              messagesStore.get().messages.length - 1
            ].seqId,
          topicId: props.contactId,
        });
        if (updateResult.isErr()) {
          alert(
            "Failed to update read messages id " + updateResult.error.message
          );
        }

        if (!isMounted) {
          return;
        }

        {
          const idbUpdateResult = await fromPromise(
            dexie.messages
              .where("topicId")
              .equals(props.contactId)
              .and(
                (x) =>
                  !(x.author == store.get().profile.profile?.userId) && !x.read
              )
              .modify({ read: true }),
            (e) => e
          );
          if (idbUpdateResult.isErr()) {
            console.error(idbUpdateResult.error);
          }
        }

        if (!isMounted) {
          return;
        }
      }

      if (!isMounted) {
        return;
      }

      conversationUIControl.current.scrollChatToTheBottom();
      conversationUIControl.current.updateFirstMessageRef();
      setShowDrawer(false);
      setToReplyMessage(false);
      setMessageSelected(null);
    },
    () => {
      // no need to do anything for cleanup
      // because we abort the effect early if component is not mounted
      // maybe we should cancel the request to get messages in cleanup
      // but because we're using WebSocket, we don't have abort request utility
      // such as the AbortController that is available for Fetch
      // so we'll leave it as it is, it doesn't cause any bugs to the end-user
    },
    [props.contactId, store.get]
  );

  const peer = store.p2p.has(props.contactId)
    ? {
        type: "old-contact" as const,
        ...store.p2p.get(props.contactId)!,
      }
    : store.newContacts.has(props.contactId)
    ? {
        type: "new-contact" as const,
        profile: store.newContacts.get(props.contactId)!,
      }
    : undefined;

  if (peer === undefined) {
    throw new Error("Contact not found");
  }

  if (store.profile.profile === null) {
    throw new Error("User profile is undefined");
  }

  const getAuthorProfileImage: ComponentProps<
    typeof ChatConversation
  >["getAuthorProfileImage"] = useCallback(
    (userId: UserId) => {
      if (userId === props.contactId) {
        return peer?.profile.profilePhotoUrl ?? undefined;
      } else if (userId === store.profile.profile?.userId) {
        return store.get().profile.profile?.profilePhotoUrl ?? undefined;
      }
    },
    [props.contactId, store.get, peer?.profile.profilePhotoUrl]
  );

  return (
    <div className="relative flex h-screen">
      <div className="w-full">
        <ChatHeader
          online={peer.type === "old-contact" ? peer.status.online : false}
          lastSeen={peer.profile.touchedAt}
          typing={
            peer.type === "old-contact"
              ? peer.status.online && peer.status.typing
                ? peer.profile.name
                : null
              : null
          }
          contactName={peer.profile.name}
          contactProfilePhotoUrl={peer?.profile.profilePhotoUrl ?? undefined}
          onInfoClick={() => setShowDrawer(true)}
          type="p2p"
          onClearMessages={() => {
            console.log("clear messages");
          }}
        />
        <div className="relative h-[calc(100%-8rem)] w-full">
          <ChatConversation
            ref={conversationUIControl}
            onReplyMessage={(m) => {
              setToReplyMessage(true);
              setMessageSelected(m);
            }}
            onChatScrollToTop={onChatScrollToTop}
            toReplyMessage={toReplyMessage ? messageSelected : null}
            showReplyPreview={toReplyMessage}
            onCloseReplyPreview={onCloseReplyPreview}
            onMessageBubbleMenuClick={onMessageBubbleMenuClick}
            getAuthorProfileImage={getAuthorProfileImage}
            chatItems={messagesStore.messages}
          />
          <div
            className={cx("absolute left-0 top-0 h-full w-full bg-white", {
              hidden: inputMode.type != "photo",
            })}
          >
            <ChatImageUploadPreviewOverlay
              ref={imgUploadPreviewRef}
              filename={inputMode.type === "photo" ? inputMode.filename : ""}
              onCloseOverlay={() => setInputMode({ type: "message" })}
            />
          </div>

          <div
            className={cx("absolute left-0 top-0 h-full w-full bg-white", {
              hidden: inputMode.type != "file",
            })}
          >
            <ChatFileUploadPreviewOverlay
              filename={inputMode.type == "file" ? inputMode.filename : ""}
              contentType={
                inputMode.type == "file" ? inputMode.contentType : ""
              }
              size={inputMode.type == "file" ? inputMode.size : 0}
              onCloseOverlay={() => {
                setInputMode({ type: "message" });
              }}
            />
          </div>
        </div>
        <TextInput
          inputMode={inputMode}
          onTyping={onTyping}
          onMessageSubmit={onMessageSubmit}
          onLoadFile={onLoadFile}
          onLoadPhoto={onLoadPhoto}
          disabled={false}
        />
      </div>

      {showDrawer && (
        <div className="w-[660px] border-l border-gray-300">
          <P2PInfoDrawer
            userName={peer.profile.name}
            userId={props.contactId}
            userProfilePhotoUrl={peer.profile.profilePhotoUrl}
            onClose={() => setShowDrawer(false)}
            onSavePermissionChanges={() => {
              console.log("NEW PERMISSION!!");
              setShowDrawer(false);
            }}
          />
        </div>
      )}

      <ChatMessageBubbleMenu
        showMenu={showMessageBubbleMenu}
        onClose={() => setShowMessageBubbleMenu(false)}
        ref={messageBubbleMenuRef}
      >
        <ChatMessageBubbleMenuItem
          onClick={() => {
            setShowForwardMessageOverlay(true);
            setShowMessageBubbleMenu(false);
          }}
          content="Forward"
        />
        <ChatMessageBubbleMenuItem
          onClick={() => {
            setToReplyMessage(true);
            setShowMessageBubbleMenu(false);
          }}
          content="Reply"
        />
        <ChatMessageBubbleMenuItem
          onClick={() => {
            setShowDeleteMessageOverlay(true);
            setShowMessageBubbleMenu(false);
          }}
          content="Delete"
        />
      </ChatMessageBubbleMenu>

      {showForwardMessageOverlay && (
        <ForwardMessageOverlay
          contacts={[
            ...Array.from(store.grp.entries()).map(([id, g]) => ({
              topicId: id,
              name: g.profile.name,
            })),
            ...Array.from(store.p2p.entries()).map(([id, p]) => ({
              topicId: id,
              name: p.profile.name,
            })),
          ]}
          onForwardMessage={async (forwardTo) => {
            if (messageSelected == null) {
              setShowForwardMessageOverlay(false);
              return;
            }

            const result = await client["topic/forward_message"]({
              message: {
                seqId: messageSelected.seqId,
                topicId: props.contactId,
              },
              forwardTo,
            });
            if (result.isOk()) {
              router.push(location.pathname + `?topic=${forwardTo}`);
            }
            setShowForwardMessageOverlay(false);
          }}
          onClose={() => {
            setShowForwardMessageOverlay(false);
          }}
        />
      )}

      {showDeleteMessageOverlay && (
        <DeleteMessageOverlay
          onDeleteForEveryone={onDeleteForEveryone}
          onDeleteForMe={onDeleteForMe}
          onCancel={() => setShowDeleteMessageOverlay(false)}
        />
      )}

      <Toaster position="bottom-left" />
    </div>
  );
}

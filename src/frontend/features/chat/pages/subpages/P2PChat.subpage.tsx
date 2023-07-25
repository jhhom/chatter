import { useRef, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { fromPromise } from "neverthrow";
import { toast, Toaster } from "react-hot-toast";
import clsx from "clsx";

import type { UserId } from "~/api-contract/subscription/subscription";

import type { ChatTextInputProps } from "~/frontend/features/chat/pages/components/ChatTextInput/ChatTextInput";
import { ChatHeader } from "~/frontend/features/chat/pages/components/ChatHeader";
import type {
  ChatConversationProps,
  IChatConversationUI,
} from "~/frontend/features/chat/pages/types";
import { ChatConversation } from "~/frontend/features/chat/pages/components/ChatConversation/ChatConversation";
import {
  SecurityContent,
  InfoContent,
  P2PInfoDrawer,
  type SecurityContentProps,
} from "~/frontend/features/chat/pages/components/ChatInfoDrawer/P2PInfoDrawer";
import { UnblockModal } from "~/frontend/features/chat/pages/components/UnblockModal";
import {
  ChatFileUploadPreviewOverlay,
  ChatImageUploadPreviewOverlay,
  ChatImageOverlay,
  DeleteMessageOverlay,
  ForwardMessageOverlay,
  type DeleteMessageOverlayProps,
} from "~/frontend/features/chat/pages/components/ChatOverlays";
import {
  ChatMessageBubbleMenu,
  ChatMessageBubbleMenuItem,
} from "~/frontend/features/chat/pages/components/ChatConversation/ChatMessageBubbleMenu";
import {
  ChatTextInput,
  type ChatInputMode,
} from "~/frontend/features/chat/pages/components/ChatTextInput/ChatTextInput";
import {
  ChatReplyPreview,
  type ChatReplyPreviewProps,
} from "~/frontend/features/chat/pages/components/ChatReplyPreview";
import type { ChatMessageTypeMessage } from "~/frontend/features/chat/pages/stores/messages/get-messages-display-sequences";

import { permission } from "~/backend/service/common/permissions";

import {
  useMessageListener,
  useDeleteMessageListener,
  useReadListener,
} from "~/frontend/features/chat/pages/hooks";

import { dexie } from "~/frontend/external/browser/indexed-db";
import { client } from "~/frontend/external/api-client/client";
import { useAppStore } from "~/frontend/stores/stores";
import { useMessagesStore } from "~/frontend/features/chat/pages/stores/messages/messages.store";

import type { P2PContactProfile } from "~/frontend/stores/contact-status.store";

export type IChatUI = Pick<
  IChatConversationUI,
  "isUserAtTheBottomOfScroll" | "scrollChatToTheBottom"
>;

const PAGE_SIZE = 24;
const INITIAL_PAGE_SIZE = 64;

export function P2PChatPage(props: { contactId: UserId }) {
  const store = useAppStore();
  const messagesStore = useMessagesStore();

  const conversationContainerRef = useRef<HTMLDivElement | null>(null);
  const messageBubbleMenuRef = useRef<HTMLDivElement | null>(null);
  const chatImgViewRef = useRef<HTMLImageElement | null>(null);
  const imgUploadPreviewRef = useRef<HTMLImageElement | null>(null);
  const chatReplyPreviewRef = useRef<HTMLDivElement | null>(null);
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

  const [inputMode, setInputMode] = useState<ChatInputMode>({
    type: "message",
  });

  const makeMessageListener = useMessageListener(props.contactId, (userId) => {
    if (userId === props.contactId) {
      const profile = store.p2p.get(props.contactId);
      if (profile === undefined) {
        return undefined;
      }
      return {
        name: profile.profile.name,
        online: profile.status.online,
      };
    }
    if (store.profile === undefined) {
      return undefined;
    }
    return {
      name: store.profile.fullname,
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

    const c = store.p2p.get(props.contactId);
    if (c) {
      store.p2p.set(props.contactId, {
        profile: {
          ...c.profile,
          lastMessage: null,
        },
        status: c.status,
      });
    }
  }, [store.p2p, props.contactId]);

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
          messagesStore.messages.findIndex((x) => x.seqId === seqId) != -1;

        if (hasMessageInDisplay) {
          conversationUIControl.current.scrollToMessage(seqId);
          return;
        }

        const hasMessagesBeforeReplyInDisplay =
          messagesStore.messages.findIndex((x) => x.seqId < seqId) != -1;
        if (hasMessagesBeforeReplyInDisplay) {
          // if in our display, we have messages earlier than the reply message
          // but it's not found in our store
          // that means that the message has been deleted before
          toast("Message not found");
          return;
        }

        const result = await messagesStore.loadMessagesUntilReply(
          messagesStore.messages[0].seqId,
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
      [messagesStore]
    );

  const onMessageBubbleMenuClick: ChatConversationProps["onMessageBubbleMenuClick"] =
    useCallback(
      (e, message) => {
        if (!showMessageBubbleMenu) {
          messageBubbleMenuRef.current?.style.setProperty(
            "--mouse-x",
            `${e.clientX}px`
          );
          messageBubbleMenuRef.current?.style.setProperty(
            "--mouse-y",
            `${e.clientY}px`
          );
        }
        setMessageSelected(message);
        setShowMessageBubbleMenu(true);
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
        conversationContainerRef.current.style.transform = `translateY(0)`;
      }
      // await animations to finish
      // before we completely hide the preview
      await new Promise((r) => setTimeout(() => r(undefined), 250));
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
        if (conversationContainerRef.current) {
          conversationContainerRef.current.style.transform = `translateY(0)`;
        }
        // await animations to finish
        // before we completely hide the preview
        await new Promise((r) => setTimeout(() => r(undefined), 250));
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

  const onTyping: ChatTextInputProps["onTyping"] = (isTyping) => {
    void client["topic/notify_typing"]({
      action: isTyping ? "typing" : "stop-typing",
      contactUserId: props.contactId,
    });
  };

  const onLoadFile: ChatTextInputProps["onLoadFile"] = (file) => {
    setInputMode({
      type: "file",
      filename: file.name,
      contentType: file.type,
      size: file.size,
    });
  };

  const onLoadPhoto: ChatTextInputProps["onLoadPhoto"] = async (photo) => {
    if (imgUploadPreviewRef.current) {
      imgUploadPreviewRef.current.src = URL.createObjectURL(photo);
    }

    await new Promise((resolve) => {
      setTimeout(() => {
        resolve(undefined);
      }, 200);
    });
    setInputMode({ type: "photo", filename: photo.name });
  };

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

  const conversationDisplayMode = useCallback(
    (
      peerPermission: string,
      userPermission: string
    ): ChatConversationProps["mode"] => {
      const peer = permission(peerPermission);
      const user = permission(userPermission);

      if (store.newContacts.has(props.contactId)) {
        if (!user.canJoin()) {
          return { type: "blocked by peer" };
        }
        if (!user.canRead()) {
          return { type: "read disabled" };
        }
        if (!user.canWrite()) {
          return { type: "write disabled" };
        }
        return { type: "normal" };
      }

      if (!user.canJoin()) {
        return { type: "blocked by peer" };
      }
      if (peer.canJoin()) {
        if (user.canRead()) {
          return { type: "normal" };
        } else if (user.canWrite()) {
          return { type: "write disabled" };
        } else {
          return { type: "read disabled" };
        }
      } else {
        return {
          type: "needs unblocking",
          onUnblock: () => {
            setShowUnblockModal(true);
          },
        };
      }
    },
    [props.contactId, store.newContacts]
  );

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
  });

  useEffect(() => {
    const loadMessagesOfTopic = async () => {
      await messagesStore.loadMessages(INITIAL_PAGE_SIZE, -1);

      if (messagesStore.messages.length != 0) {
        const updateResult = await client["topic/update_message_read_status"]({
          sequenceId:
            messagesStore.messages[messagesStore.messages.length - 1].seqId,
          topicId: props.contactId,
        });
        if (updateResult.isErr()) {
          alert(
            "Failed to update read messages id " + updateResult.error.message
          );
        }

        {
          const idbUpdateResult = await fromPromise(
            dexie.messages
              .where("topicId")
              .equals(props.contactId)
              .and((x) => !(x.author == store.profile?.userId) && !x.read)
              .modify({ read: true }),
            (e) => e
          );
          if (idbUpdateResult.isErr()) {
            console.error(idbUpdateResult.error);
          }
        }
      }

      conversationUIControl.current.scrollChatToTheBottom();
      conversationUIControl.current.updateFirstMessageRef();
      setShowDrawer(false);
      if (conversationContainerRef.current) {
        conversationContainerRef.current.style.transform = `translateY(0)`;
      }
      await new Promise((r) => setTimeout(() => r(undefined), 250));
      setToReplyMessage(false);
      setMessageSelected(null);
    };

    void loadMessagesOfTopic();
  }, [props.contactId, messagesStore, store.profile?.userId]);

  const peer = store.p2p.get(props.contactId);

  if (peer === undefined) {
    throw new Error("Contact not found");
  }

  return (
    <div className="relative flex h-screen">
      <div className="h-full flex-grow">
        <ChatHeader
          type="p2p"
          online={peer.status.online}
          name={peer.profile.name}
          lastSeen={peer.status.online ? null : peer.status.lastOnline}
          typing={
            peer.status.online && peer.status.typing ? peer.profile.name : null
          }
          profilePhotoUrl={peer.profile.profilePhotoUrl}
          onBlock={onBlock}
          onClearMessages={onClearMessages}
          onInfoClick={() => setShowDrawer(true)}
        />

        <div className="relative h-[calc(100vh-3rem-3.5rem)] overflow-hidden">
          <div
            ref={conversationContainerRef}
            className="absolute top-0 h-full w-full transition-transform duration-200"
          >
            <ChatConversation
              peerName={peer.profile.name}
              userId={props.contactId}
              messages={messagesStore.messages}
              isNewContact={store.newContacts.has(props.contactId)}
              ref={conversationUIControl}
              mode={conversationDisplayMode(
                peer.profile.peerPermissions,
                peer.profile.userPermissions
              )}
              onChatScrollToTop={onChatScrollToTop}
              onReplyMessageClick={onReplyMessageClick}
              onMessageBubbleMenuClick={onMessageBubbleMenuClick}
              onMessageImageClick={onMessageImageClick}
            />
            <div
              ref={chatReplyPreviewRef}
              className="w-full items-center bg-blue-500 text-white"
            >
              {messageSelected !== null && toReplyMessage && (
                <ChatReplyPreview
                  onClose={onCloseReplyPreview}
                  messageReplied={messageSelected}
                />
              )}
            </div>
          </div>
        </div>

        <ChatTextInput
          inputMode={inputMode}
          disabled={
            conversationDisplayMode(
              peer.profile.peerPermissions,
              peer.profile.userPermissions
            ).type !== "normal" ||
            !permission(peer.profile.userPermissions).canWrite
          }
          onMessageSubmit={onMessageSubmit}
          onTyping={onTyping}
          onLoadFile={onLoadFile}
          onLoadPhoto={onLoadPhoto}
        />
      </div>

      {showDrawer && (
        <div className="h-full basis-2/5">
          <P2PInfoDrawer onClose={() => setShowDrawer(false)}>
            {(p) =>
              p.content === "security" ? (
                <SecurityContent
                  userPermission={peer.profile.userPermissions}
                  peerPermission={peer.profile.peerPermissions}
                  onSubmitPermissionChange={onSubmitPermissionChange(() =>
                    p.setContent("info")
                  )}
                  onCancel={() => p.setContent("info")}
                />
              ) : (
                <InfoContent
                  userFullname={peer.profile.name}
                  userId={props.contactId}
                  onSecurityClick={() => p.setContent("security")}
                />
              )
            }
          </P2PInfoDrawer>
        </div>
      )}

      {showUnblockModal && (
        <UnblockModal
          name={peer.profile.name}
          onUnblock={async () => {
            void (await client["permissions/update_peer_permission"]({
              newPermission: peer.profile.peerPermissions + "J",
              peerId: props.contactId,
            }));
            setShowUnblockModal(false);
          }}
          onCancel={() => setShowUnblockModal(false)}
        />
      )}

      <div
        className={clsx(
          "absolute left-0 top-0 h-[calc(100%-3rem)] w-full bg-white",
          {
            hidden: inputMode.type != "photo",
          }
        )}
      >
        <ChatImageUploadPreviewOverlay
          ref={imgUploadPreviewRef}
          filename={inputMode.type == "photo" ? inputMode.filename : ""}
          onCloseOverlay={() => {
            setInputMode({ type: "message" });
          }}
        />
      </div>

      <div
        className={clsx(
          "absolute left-0 top-0 h-[calc(100%-3rem)] w-full bg-white",
          {
            hidden: inputMode.type != "file",
          }
        )}
      >
        <ChatFileUploadPreviewOverlay
          filename={inputMode.type == "file" ? inputMode.filename : ""}
          contentType={inputMode.type == "file" ? inputMode.contentType : ""}
          size={inputMode.type == "file" ? inputMode.size : 0}
          onCloseOverlay={() => {
            setInputMode({ type: "message" });
          }}
        />
      </div>

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
            if (
              conversationContainerRef.current &&
              chatReplyPreviewRef.current
            ) {
              conversationContainerRef.current.style.transform = `translateY(-${chatReplyPreviewRef.current.clientHeight}px)`;
            }
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

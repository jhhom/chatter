import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ComponentProps,
} from "react";
import { toast, Toaster } from "react-hot-toast";
import { ok, err, fromPromise } from "neverthrow";
import { useRouter } from "next/navigation";
import clsx from "clsx";

import type {
  UserId,
  GroupTopicId,
} from "~/api-contract/subscription/subscription";
import { permission } from "~/backend/service/common/permissions";

import type { IChatConversationUI } from "~/frontend/frontend-2/features/chat/pages/types";
import type { ChatMessageTypeMessage } from "~/frontend/frontend-2/features/chat/pages/stores/messages/get-messages-display-sequences";
import { ChatConversation } from "~/frontend/frontend-2/features/chat/pages/components2/ChatConversation/ChatConversation";
import { ChatHeader } from "~/frontend/frontend-2/features/chat/pages/components2/ChatHeader";
import {
  ChatReplyPreview,
  type ChatReplyPreviewProps,
} from "~/frontend/frontend-2/features/chat/pages/components/ChatReplyPreview";
import {
  ChatFileUploadPreviewOverlay,
  ChatImageUploadPreviewOverlay,
  ForwardMessageOverlay,
  DeleteMessageOverlay,
  ChatImageOverlay,
} from "~/frontend/frontend-2/features/chat/pages/components2/ChatOverlays";
import {
  TextInput,
  type TextInputProps,
  type TextInputMode,
} from "~/frontend/frontend-2/features/chat/pages/components2/TextInput/TextInput";
import {
  ChatMessageBubbleMenu,
  ChatMessageBubbleMenuItem,
} from "~/frontend/frontend-2/features/chat/pages/components/ChatConversation/ChatMessageBubbleMenu";

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
import { clsx as cx } from "clsx";
import useAsyncEffect from "use-async-effect";
import {
  GroupInfoDrawer3,
  DrawerContentSecurity,
  DrawerContentInviteLink,
  DrawerContentInfo,
  DrawerContentAddMembersToGroup,
} from "~/frontend/frontend-2/features/chat/pages/components2/Drawers/GrpInfoDrawer/GrpInfoDrawer2";
import { DrawerContentMemberSecurity } from "~/frontend/frontend-2/features/chat/pages/components2/Drawers/GrpInfoDrawer/DrawerContentMemberSecurity";
import { useMessageInputResize } from "~/frontend/frontend-2/features/chat/pages/hooks/use-message-input-resize.hook";

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
  const [inputMode, setInputMode] = useState<TextInputMode>({
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

  const { chatContainerRef, messageInputContainerRef } = useMessageInputResize({
    resizedHeight(messageInputContainerHeight) {
      return `calc(100vh - (4rem + 1.5px) - ${
        messageInputContainerHeight + 1.5
      }px)`;
    },
  });

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

        membersStore.clear();

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

  const onClearMessages: ComponentProps<typeof ChatHeader>["onClearMessages"] =
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

  const onChatScrollToTop: ComponentProps<
    typeof ChatConversation
  >["onChatScrollToTop"] = useCallback(async () => {
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

  const onReplyMessage: ComponentProps<
    typeof ChatConversation
  >["onReplyMessage"] = useCallback(
    async (m: ChatMessageTypeMessage) => {
      const seqId = m.seqId;
      const hasMessageInDisplay =
        messagesStore.get().messages.findIndex((x) => x.seqId === seqId) !== -1;
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

  const onMessageBubbleMenuClick: ComponentProps<
    typeof ChatConversation
  >["onMessageBubbleMenuClick"] = useCallback(
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

  const onMessageImageClick: ComponentProps<
    typeof ChatConversation
  >["onMessageImageClick"] = useCallback(async (messageUrl) => {
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

  const onReplyMessageClick: ComponentProps<
    typeof ChatConversation
  >["onReplyMessageClick"] = useCallback(
    async (seqId) => {
      const hasMessageInDisplay =
        messagesStore.get().messages.findIndex((x) => x.seqId === seqId) !== -1;
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

  const onMessageSubmit: TextInputProps["onMessageSubmit"] = useCallback(
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

  const onTyping: TextInputProps["onTyping"] = useCallback(
    (isTyping) => {
      void client["topic/notify_typing"]({
        action: isTyping ? "typing" : "stop-typing",
        contactUserId: props.contactId,
      });
    },
    [props.contactId]
  );

  const onLoadFile: TextInputProps["onLoadFile"] = useCallback((file) => {
    setInputMode({
      type: "file",
      filename: file.name,
      contentType: file.type,
      size: file.size,
    });
  }, []);

  const onLoadPhoto: TextInputProps["onLoadPhoto"] = useCallback(
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

  const getAuthorProfileImage: ComponentProps<
    typeof ChatConversation
  >["getAuthorProfileImage"] = useCallback(
    (userId: UserId) => {
      if (userId === store.get().profile.profile?.userId) {
        return store.get().profile.profile?.profilePhotoUrl ?? undefined;
      } else {
        const profile = membersStore.getMembers().get(userId);
        return profile?.profilePhotoUrl ?? undefined;
      }
    },
    [store.get, membersStore.getMembers]
  );

  return (
    <div className="relative flex h-screen ">
      <div className="flex-shrink flex-grow overflow-x-hidden ">
        <ChatHeader
          online={store.grp.status.online}
          lastSeen={null}
          typing={
            store.grp.status.online && store.grp.status.latestTyping !== null
              ? store.grp.status.latestTyping.fullname
              : null
          }
          contactName={store.grp.profile.name}
          contactProfilePhotoUrl={
            store.grp.profile.profilePhotoUrl ?? undefined
          }
          onClearMessages={onClearMessages}
          onInfoClick={() => setShowDrawer(true)}
          type="grp"
        />
        <div
          ref={chatContainerRef}
          className="relative h-[calc(100%-8rem)] w-full"
        >
          <ChatConversation
            isNewContact={false}
            peerName={store.grp.profile.name}
            ref={conversationUIControl}
            onReplyMessageClick={onReplyMessageClick}
            onReplyMessage={onReplyMessage}
            onChatScrollToTop={onChatScrollToTop}
            toReplyMessage={toReplyMessage ? messageSelected : null}
            showReplyPreview={toReplyMessage}
            onCloseReplyPreview={onCloseReplyPreview}
            onMessageBubbleMenuClick={onMessageBubbleMenuClick}
            getAuthorProfileImage={getAuthorProfileImage}
            chatItems={messagesStore.messages}
            mode={conversationDisplayMode}
            onMessageImageClick={onMessageImageClick}
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
          ref={messageInputContainerRef}
          inputMode={inputMode}
          onTyping={onTyping}
          onMessageSubmit={onMessageSubmit}
          onLoadFile={onLoadFile}
          onLoadPhoto={onLoadPhoto}
          disabled={conversationDisplayMode.type !== "normal"}
        />
      </div>

      <ChatMessageBubbleMenu
        showMenu={showMessageBubbleMenu}
        onClose={() => setShowMessageBubbleMenu(false)}
        ref={messageBubbleMenuRef}
      >
        {!messageSelected?.deleted && (
          <>
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
          </>
        )}

        <ChatMessageBubbleMenuItem
          onClick={() => {
            setShowDeleteMessageOverlay(true);
            setShowMessageBubbleMenu(false);
          }}
          content="Delete"
        />
      </ChatMessageBubbleMenu>

      {showDrawer && (
        <div className="h-full flex-shrink-0 basis-full lg:basis-2/5">
          <GroupInfoDrawer3 onClose={() => setShowDrawer(false)}>
            {(p) => {
              return match(p.content)
                .with("security", () => {
                  if (store.grp === undefined) {
                    throw new Error("Group is undefined");
                  }

                  return (
                    <DrawerContentSecurity
                      userPermission={store.grp?.profile.userPermissions}
                      groupDefaultPermission={
                        store.grp?.profile.defaultPermissions
                      }
                      onBack={() => p.setContent("info")}
                      editable={permission(
                        store.grp.profile.userPermissions
                      ).canAdminister()}
                      onSubmitPermissionChange={async (permission) => {
                        const r = await client[
                          "permissions/update_group_default_permission"
                        ]({
                          groupTopicId: props.contactId,
                          newDefaultPermission: permission,
                        });
                        if (r.isErr()) {
                          alert(
                            "Failed to update group default permission: " +
                              r.error.message
                          );
                          return;
                        }
                        p.setContent("info");
                      }}
                    />
                  );
                })
                .with("invite-link", () => (
                  <DrawerContentInviteLink
                    groupId={props.contactId}
                    groupName={store.grp?.profile.name ?? ""}
                    groupProfilePhotoUrl={
                      store.grp?.profile.profilePhotoUrl ?? undefined
                    }
                    getInviteLink={async () => {
                      const r = await client["group/invite_link"]({
                        groupTopicId: props.contactId,
                      });
                      if (r.isErr()) {
                        console.error(
                          `Failed to get group invite link: ` + r.error.message
                        );
                        return "";
                      }
                      return r.value.inviteLink;
                    }}
                    resetInviteLink={() => {
                      //
                    }}
                    onCopyInviteLink={() => {
                      toast("Link copied to clipboard");
                    }}
                  />
                ))
                .with("add-member", () => (
                  <DrawerContentAddMembersToGroup
                    groupTopicId={props.contactId}
                    onCancelClick={() => setShowDrawer(false)}
                    onAfterMembersAdded={() => setShowDrawer(false)}
                    onAddMembers={async (membersToAdd) => {
                      const r = await client["group/add_members"]({
                        groupTopicId: props.contactId,
                        membersToAdd: membersToAdd,
                      });
                      if (r.isErr()) {
                        return err(r.error);
                      }
                      return ok(r.value);
                    }}
                    searchNewMembersByName={async (query) => {
                      const result = await client["group/find_new_members"]({
                        searchQueryUsername: query,
                        groupTopicId: props.contactId,
                      });
                      if (result.isErr()) {
                        alert(result.error);
                        return [];
                      }
                      return result.value;
                    }}
                  />
                ))
                .with("member-security", () => (
                  <DrawerContentMemberSecurity
                    username={
                      p.checkingOutMember
                        ? membersStore.members.get(p.checkingOutMember)?.name ??
                          ""
                        : ""
                    }
                    editable={p.memberSecurityContentEditable}
                    onCancel={() => p.setContent("info")}
                    getMemberPermission={async () => {
                      if (p.checkingOutMember === null) {
                        return "";
                      }
                      const r = await client[
                        "permissions/get_group_member_permission"
                      ]({
                        groupTopicId: props.contactId,
                        memberUserId: p.checkingOutMember,
                      });
                      if (r.isErr()) {
                        console.error(
                          `Failed to get member permission in group`,
                          r.error
                        );
                        return "";
                      }

                      return r.value;
                    }}
                    onSubmitPermissionChange={async (permission) => {
                      if (p.checkingOutMember === null) {
                        return "";
                      }
                      const updatedPermission = await client[
                        "permissions/update_group_member_permission"
                      ]({
                        groupTopicId: props.contactId,
                        memberUserId: p.checkingOutMember,
                        newPermission: permission,
                      });
                      p.setContent("info");
                      if (updatedPermission.isErr()) {
                        console.error(
                          `Failed to update member permission in group`,
                          updatedPermission.error
                        );
                        return "";
                      }
                      return updatedPermission.value;
                    }}
                  />
                ))
                .otherwise(() => {
                  const grp = store.grp;
                  if (grp === undefined) {
                    throw new Error("Group is undefined");
                  }

                  if (!store.profile.profile) {
                    throw new Error("User profile is undefined");
                  }

                  return (
                    <DrawerContentInfo
                      groupId={props.contactId}
                      groupName={grp.profile.name}
                      groupOwnerId={grp.profile.ownerId}
                      userId={store.profile.profile.userId}
                      userPermissions={grp.profile.userPermissions}
                      canInvite={permission(
                        grp.profile.userPermissions
                      ).canShare()}
                      memberList={Array.from(
                        membersStore.members.entries()
                      ).map(([uId, uProfile]) => {
                        return {
                          userId: uId,
                          name: uProfile.name,
                          online: uProfile.online,
                          profilePhotoUrl: uProfile.profilePhotoUrl,
                        };
                      })}
                      profilePhotoUrl={
                        store.grp?.profile.profilePhotoUrl ?? null
                      }
                      onLeaveGroup={async () => {
                        const r = await client["group/leave_group"]({
                          groupTopicId: props.contactId,
                        });
                        if (r.isErr()) {
                          alert(`Failed to leave group: ${r.error.message}`);
                          return;
                        }
                      }}
                      onContactRemove={async (removedUserId) => {
                        const r = await client["group/remove_member"]({
                          groupTopicId: props.contactId,
                          memberId: removedUserId,
                        });
                        if (r.isErr()) {
                          alert(
                            "error removing from group: " + r.error.message
                          );
                          return;
                        }
                      }}
                      onEditPermissions={(userId) => {
                        p.setCheckingOutMember(userId);
                        p.setContent("member-security");
                        p.setMemberSecurityContentEditable(true);
                      }}
                      onViewPermissions={(userId) => {
                        p.setCheckingOutMember(userId);
                        p.setContent("member-security");
                        p.setMemberSecurityContentEditable(false);
                      }}
                      onSecurityClick={() => p.setContent("security")}
                      onInviteLinkClick={() => p.setContent("invite-link")}
                      onAddMemberClick={() => p.setContent("add-member")}
                    />
                  );
                });
            }}
          </GroupInfoDrawer3>
        </div>
      )}

      {showForwardMessageOverlay && (
        <ForwardMessageOverlay
          open={showForwardMessageOverlay}
          contacts={[
            ...Array.from(store.p2pList).map(([id, p]) => ({
              topicId: id,
              name: p.profile.name,
            })),
            ...Array.from(store.groupList).map(([id, g]) => ({
              topicId: id,
              name: g.profile.name,
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

      <div
        className={cx("absolute left-0 top-0 h-[calc(100%)] w-full bg-white", {
          hidden: !showMessageImageOverlay,
        })}
      >
        <ChatImageOverlay
          ref={chatImgViewRef}
          onCloseOverlay={() => setShowMessageImageOverlay(false)}
        />
      </div>

      <DeleteMessageOverlay
        open={showDeleteMessageOverlay}
        onDeleteForEveryone={
          messageSelected?.userIsAuthor ||
          permission(store.grp.profile.userPermissions).canDelete()
            ? async () => {
                setShowDeleteMessageOverlay(false);
                if (messageSelected === null) {
                  throw new Error("No message is selected for deletion");
                }
                const r = await client["topic/delete_message"]({
                  topicId: props.contactId,
                  messageSeqId: messageSelected.seqId,
                  deleteFor: "everyone",
                });
                if (r.isErr()) {
                  alert(`Failed to delete message: ${r.error.message}`);
                  return;
                }
              }
            : undefined
        }
        onDeleteForMe={async () => {
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
        }}
        onCancel={() => setShowDeleteMessageOverlay(false)}
      />
    </div>
  );
}

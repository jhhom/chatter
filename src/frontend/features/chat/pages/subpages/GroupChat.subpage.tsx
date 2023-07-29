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
} from "~/frontend/features/chat/pages/types";
import type { ChatMessageTypeMessage } from "~/frontend/features/chat/pages/stores/messages/get-messages-display-sequences";
import { ChatConversation } from "~/frontend/features/chat/pages/components/ChatConversation/ChatConversation";
import {
  ChatHeader,
  type ChatHeaderProps,
} from "~/frontend/features/chat/pages/components/ChatHeader";
import { ChatTextInput } from "~/frontend/features/chat/pages/components/ChatTextInput/ChatTextInput";
import { GroupInfoDrawer } from "~/frontend/features/chat/pages/components/ChatInfoDrawer";
import { GroupInfo } from "~/frontend/features/chat/pages/components/ChatInfoDrawer";
import { GroupAddMember } from "~/frontend/features/chat/pages/components/ChatInfoDrawer";
import { GroupSecurityContent } from "~/frontend/features/chat/pages/components/ChatInfoDrawer";
import {
  ChatReplyPreview,
  type ChatReplyPreviewProps,
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

import { useMessagesStore } from "~/frontend/features/chat/pages/stores/messages/messages.store";
import { useMembersStore } from "~/frontend/features/chat/pages/stores/members/members.store";
import {
  useDeleteMessageListener,
  useEventLogListener,
  useGroupEventLogListener,
  useMessageListener,
  useReadListener,
} from "~/frontend/features/chat/pages/hooks";
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
  >[0]["mode"] = (() => {
    const user = permission(store.grp.profile.userPermissions);

    if (!user.canRead()) {
      return { type: "read disabled" };
    } else if (!user.canWrite()) {
      return { type: "write disabled" };
    } else {
      return { type: "normal" };
    }
  })();

  useEffect(() => {
    console.log("GROUP PROFILE CHANGE", store.grp);
  }, [store.grp]);

  useEffect(() => {
    console.log("USER PERMISSION CHANGE", store.grp?.profile.userPermissions);
  }, [store.grp.profile.userPermissions]);

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

  return (
    <div className="relative flex h-screen">
      <div className="h-full flex-grow">
        <ChatHeader
          type="group"
          name={store.grp.profile.name}
          online={store.grp.status.online}
          lastSeen={null}
          typing={
            store.grp.status.online && store.grp.status.latestTyping !== null
              ? store.grp.status.latestTyping.fullname
              : null
          }
          profilePhotoUrl={store.grp.profile.profilePhotoUrl}
          onInfoClick={() => setShowDrawer(true)}
          onClearMessages={onClearMessages}
        />

        <div className="relative h-[calc(100vh-3rem-3.5rem)] overflow-hidden">
          <div
            ref={conversationContainerRef}
            className="absolute top-0 h-full w-full transition-transform duration-200"
          >
            <ChatConversation
              ref={conversationUIControl}
              isNewContact={false}
              peerName={store.grp.profile.name}
              userId={store.grp.profile.ownerId}
              mode={conversationDisplayMode}
              messages={messagesStore.messages}
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

      {showDrawer && (
        <div className="h-full basis-2/5">
          <GroupInfoDrawer onClose={() => setShowDrawer(false)}>
            {(p) => {
              return match(p.content)
                .with("member-security", () => (
                  <GroupMemberSecurityContent
                    username={
                      p.checkingOutMember
                        ? membersStore.members.get(p.checkingOutMember)?.name ??
                          ""
                        : ""
                    }
                    editable={p.memberSecurityContentEditable}
                    onCancel={() => p.setContent("display-info")}
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
                      p.setContent("display-info");
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
                .with("invite-link", () => (
                  <GroupInviteLinkInfo
                    groupId={props.contactId}
                    groupName={store.grp?.profile.name ?? ""}
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
                .with("display-info", () => {
                  if (store.profile.profile === null) {
                    throw new Error("User profile is null");
                  }
                  if (store.grp === undefined) {
                    throw new Error("Group is undefined");
                  }
                  return (
                    <GroupInfo
                      profile={{
                        name: store.grp.profile.name,
                        id: props.contactId,
                        ownerId: store.grp.profile.ownerId,
                        userId: store.profile.profile.userId,
                      }}
                      permissions={store.grp.profile.userPermissions}
                      canInvite={permission(
                        store.grp.profile.userPermissions
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
                      onLeaveGroup={async () => {
                        const r = await client["group/leave_group"]({
                          groupTopicId: props.contactId,
                        });
                        if (r.isErr()) {
                          alert(`Failed to leave group: ${r.error.message}`);
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
                      onInviteToGroupClick={() => p.setContent("invite-link")}
                      onAddMemberClick={() => p.setContent("add-member")}
                      onSecurityClick={() => p.setContent("security")}
                    />
                  );
                })
                .with("add-member", () => (
                  <div className="h-full">
                    <GroupAddMember
                      groupTopicId={props.contactId}
                      onCancelClick={() => setShowDrawer(false)}
                      onAfterMembersAdded={() => p.setContent("display-info")}
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
                  </div>
                ))
                .with("security", () => {
                  if (store.grp === undefined) {
                    throw new Error("Group is undefined");
                  }

                  return (
                    <div className="h-full">
                      <GroupSecurityContent
                        userPermission={store.grp.profile.userPermissions}
                        groupDefaultPermission={
                          store.grp.profile.defaultPermissions
                        }
                        editable={permission(
                          store.grp.profile.userPermissions
                        ).canAdminister()}
                        onCancel={() => p.setContent("display-info")}
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
                          p.setContent("display-info");
                        }}
                      />
                    </div>
                  );
                })
                .run();
            }}
          </GroupInfoDrawer>
        </div>
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
          filename={inputMode.type === "photo" ? inputMode.filename : ""}
          onCloseOverlay={() => setInputMode({ type: "message" })}
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
            const msgSelected = messageSelected;
            if (msgSelected == null) {
              setShowForwardMessageOverlay(false);
              return;
            }
            const result = await client["topic/forward_message"]({
              message: {
                seqId: msgSelected.seqId,
                topicId: props.contactId,
              },
              forwardTo,
            });
            if (result.isErr()) {
              alert("Error forward message " + result.error.message);
              return;
            }

            router.push(location.pathname + `?topic=${forwardTo}`);
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
            // await animations to finish
            // before we completely hide the preview
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
      )}

      <Toaster position="bottom-left" />
    </div>
  );
}

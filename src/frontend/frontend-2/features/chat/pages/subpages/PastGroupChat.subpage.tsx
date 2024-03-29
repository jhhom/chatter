import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  type ComponentProps,
} from "react";
import useAsyncEffect from "use-async-effect";
import { fromPromise } from "neverthrow";
import { clsx as cx } from "clsx";
import { toast } from "react-hot-toast";

import type {
  GroupTopicId,
  UserId,
} from "~/api-contract/subscription/subscription";
import { ChatConversation } from "~/frontend/frontend-2/features/chat/pages/components2/ChatConversation/ChatConversation";
import type { IChatConversationUI } from "~/frontend/frontend-2/features/chat/pages/types";
import { useEventLogListener } from "~/frontend/frontend-2/features/chat/pages/hooks";
import { ChatImageOverlay } from "~/frontend/frontend-2/features/chat/pages/components2/ChatOverlays";
import { useAppStore } from "~/frontend/stores/stores";
import { useMessagesStore } from "~/frontend/frontend-2/features/chat/pages/stores/messages/messages.store";
import { client } from "~/frontend/external/api-client/client";
import { dexie } from "~/frontend/external/browser/indexed-db";
import { PastGroupChatHeader } from "~/frontend/frontend-2/features/chat/pages/components2/ChatHeader";
import { GroupInfoDrawer3 } from "~/frontend/frontend-2/features/chat/pages/components2/Drawers/GrpInfoDrawer/GrpInfoDrawer2";
import { PastGrpDrawerContentInfo } from "~/frontend/frontend-2/features/chat/pages/components2/Drawers/PastGrpInfoDrawer";

const PAGE_SIZE = 24;
const INITIAL_PAGE_SIZE = 64;

export function PastGroupChatPage(props: { contactId: GroupTopicId }) {
  const store = useAppStore((s) => ({
    profile: s.profile,
    pastGrp: s.pastGrp.get(props.contactId),
  }));
  const messagesStore = useMessagesStore();

  const [showDrawer, setShowDrawer] = useState(false);
  const [showMessageImageOverlay, setShowMessageImageOverlay] = useState(false);

  const chatImgViewRef = useRef<HTMLImageElement | null>(null);
  const conversationUIControl = useRef<IChatConversationUI | null>(null);

  const makeEventLogListener = useEventLogListener(props.contactId);

  useEffect(() => {
    if (conversationUIControl.current === null) {
      return;
    }
    const eventLogListener = makeEventLogListener(
      conversationUIControl.current
    );
    const eventLogListenerId = client.addListener(
      "notification.topic-event",
      eventLogListener
    );

    return () => {
      client.removeListener("notification.topic-event", eventLogListenerId);
    };
  }, [makeEventLogListener]);

  useAsyncEffect(
    async (isMounted) => {
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
      return undefined;
    },
    [pastGrpMemberList]
  );

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

  return (
    <div className="relative flex h-screen">
      <div className="w-full">
        <PastGroupChatHeader
          groupName={store.pastGrp.profile.name}
          onInfoClick={() => setShowDrawer(true)}
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
            onReplyMessageClick={onReplyMessageClick}
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

      {showDrawer && (
        <div className="h-full basis-2/5">
          <GroupInfoDrawer3 onClose={() => setShowDrawer(false)}>
            {() => {
              const grp = store.pastGrp;
              if (grp === undefined) {
                throw new Error("Group is undefined");
              }

              if (!store.profile.profile) {
                throw new Error("User profile is undefined");
              }
              return (
                <div className="h-full">
                  <PastGrpDrawerContentInfo
                    groupName={grp.profile.name}
                    groupId={props.contactId}
                    userId={store.profile.profile.userId}
                    userFullname={store.profile.profile.fullname}
                    profilePhotoUrl={store.profile.profile.profilePhotoUrl}
                    memberList={grp.profile.memberList}
                  />
                </div>
              );
            }}
          </GroupInfoDrawer3>
        </div>
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
    </div>
  );
}

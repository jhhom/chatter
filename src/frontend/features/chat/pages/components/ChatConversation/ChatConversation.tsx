import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

import ChatMessage from "~/frontend/features/chat/pages/components/ChatConversation/ChatMessage";
import type { UserId } from "~/api-contract/subscription/subscription";
import type { ChatMessageType } from "~/frontend/features/chat/pages/stores/messages/get-messages-display-sequences";
import type { ChatMessageTypeMessage } from "~/frontend/features/chat/pages/stores/messages/get-messages-display-sequences";

import { match } from "ts-pattern";

export type IChatConversationUI = {
  updateFirstMessageRef: () => void;
  isUserAtTheBottomOfScroll: () => boolean;
  scrollChatToTheBottom: () => void;
  scrollToMessage: (seqId: number) => void;
};

type ChatConversationProps = {
  /** id of the login-ed user */
  peerName: string;
  userId: UserId;
  messages: ChatMessageType[];
  isNewContact: boolean;
  onChatScrollToTop: () => Promise<
    "new messages loaded" | "no new messages loaded"
  >;
  onMessageImageClick: (messageUrl: string) => void;
  onMessageBubbleMenuClick: (
    e: React.MouseEvent,
    message: ChatMessageTypeMessage
  ) => void;
  onReplyMessageClick: (messageSeqId: number) => void;
  mode:
    | {
        type: "normal";
      }
    | {
        type: "needs unblocking";
        onUnblock: () => void;
      }
    | {
        type: "blocked by peer";
      }
    | {
        type: "read disabled";
      }
    | {
        type: "write disabled";
      }
    | {
        type: "removed from group";
      };
};

export const ChatConversation = forwardRef<
  IChatConversationUI,
  ChatConversationProps
>(function ChatConversation(props, ref) {
  const firstMessageRef = useRef<HTMLDivElement | null>(null);
  const conversationContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const r = conversationContainerRef.current;
    if (r === null) {
      return;
    }
    const onScroll = async (e: Event) => {
      if (r.scrollTop <= 0) {
        const messageMarginTop = 4 + 1.75;
        const result = await props.onChatScrollToTop();
        if (result == "no new messages loaded") {
          return;
        }

        if (firstMessageRef.current) {
          r.scrollTo(
            0,
            firstMessageRef.current.offsetTop - r.offsetTop - messageMarginTop
          );
        }

        firstMessageRef.current = conversationContainerRef.current
          ?.firstChild as HTMLDivElement;
      }
    };

    r.addEventListener("scroll", onScroll);

    return () => {
      r.removeEventListener("scroll", onScroll);
    };
  }, [props.onChatScrollToTop]);

  useEffect(() => {
    console.log("MESSAGES DISPLAYED", props.messages);
  }, [props.messages]);

  useImperativeHandle(
    ref,
    (): IChatConversationUI => {
      return {
        updateFirstMessageRef() {
          firstMessageRef.current = conversationContainerRef.current
            ?.firstChild as HTMLDivElement;
        },
        isUserAtTheBottomOfScroll() {
          const r = conversationContainerRef.current;
          if (r === null) {
            return true;
          }
          return Math.abs(r.scrollHeight - r.scrollTop - r.clientHeight) < 5;
        },
        scrollChatToTheBottom() {
          return conversationContainerRef.current?.scrollTo(
            0,
            conversationContainerRef.current.scrollHeight
          );
        },
        scrollToMessage(seqId: number) {
          const messageEl = document.getElementById(`message-${seqId}`);
          if (messageEl == undefined) {
            return;
          }
          conversationContainerRef.current?.scroll({
            top: messageEl.offsetTop,
            behavior: "smooth",
          });
        },
      };
    },
    []
  );

  return (
    <div className="relative flex h-full flex-col">
      {props.mode.type === "read disabled" ? (
        <div className="flex-grow"></div>
      ) : (
        <div
          ref={conversationContainerRef}
          className="flex flex-grow flex-col content-between overflow-auto bg-gray-200 px-3 pb-2"
        >
          {props.messages.map((msg) =>
            msg.type === "message" ? (
              <ChatMessage
                key={msg.seqId}
                type="message"
                userIsAuthor={msg.authorId == props.userId}
                authorId={msg.authorId}
                authorName={msg.authorName}
                seq={msg.seq}
                date={msg.date}
                content={msg.text}
                isFirstOfDate={msg.isFirstOfDate}
                read={msg.read}
                seqId={msg.seqId}
                onImageClick={props.onMessageImageClick}
                onMenuClick={(e) => props.onMessageBubbleMenuClick(e, msg)}
                deleted={msg.deleted}
                onReplyMessageClick={() => {
                  if (msg.text.replyTo !== null) {
                    props.onReplyMessageClick(msg.text.replyTo.seqId);
                  }
                }}
              />
            ) : (
              <ChatMessage
                key={msg.seqId}
                type="event_log"
                content={msg.text}
                seqId={msg.seqId}
                isFirstOfDate={msg.isFirstOfDate}
                date={msg.date}
              />
            )
          )}
        </div>
      )}

      {props.mode.type !== "normal" && props.isNewContact && (
        <div className="sticky bottom-0 bg-red-200 px-3 py-2">
          {match(props.mode.type)
            .with("read disabled", () => (
              <p>{props.peerName} has disabled viewing past conversations</p>
            ))
            .with("blocked by peer", () => (
              <p>
                {props.peerName} is currently not letting any newly added
                contacts send messages to them currently
              </p>
            ))
            .with("write disabled", () => (
              <p>
                {props.peerName} is not letting any newly added contacts send
                messages to them currently
              </p>
            ))
            .run()}
        </div>
      )}

      {props.mode.type !== "normal" && !props.isNewContact && (
        <div className="sticky bottom-0 bg-red-200 px-3 py-2">
          {match(props.mode.type)
            .with("removed from group", () => (
              <p>You're no longer a participant of the group</p>
            ))
            .with("write disabled", () => (
              <p>
                {props.peerName} has disabled you from sending new messages to
                them
              </p>
            ))
            .with("read disabled", () => (
              <p>{props.peerName} has disabled viewing past conversations</p>
            ))
            .with("blocked by peer", () => (
              <p>You have been blocked by {props.peerName}</p>
            ))
            .with("needs unblocking", () => (
              <p>
                You have blocked {props.peerName},{" "}
                <button
                  onClick={() =>
                    props.mode.type == "needs unblocking" &&
                    props.mode.onUnblock()
                  }
                  className="underline"
                >
                  unblock
                </button>{" "}
                them to send new messages
              </p>
            ))
            .run()}
        </div>
      )}
    </div>
  );
});

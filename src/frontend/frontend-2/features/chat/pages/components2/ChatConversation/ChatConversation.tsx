import { useRef } from "react";

import { ConversationItem } from "~/frontend/frontend-2/features/chat/pages/components2/ChatConversation/ChatMessage";
import { type ChatMessageTypeMessage } from "~/frontend/frontend-2/features/chat/pages/components/ChatConversation/ChatMessage";
import {
  IconFile,
  IconCamera,
  IconX,
} from "~/frontend/frontend-2/features/common/icons";

import { clsx as cx } from "clsx";
import { match } from "ts-pattern";
import { type ChatMessageType } from "~/frontend/frontend-2/features/chat/pages/stores/messages/get-messages-display-sequences";
import { type UserId } from "~/api-contract/subscription/subscription";

type GetAuthorProfileImage = (userId: UserId) => string | undefined;

export function ChatConversation(props: {
  chatItems: ChatMessageType[];
  onReplyMessage: (m: ChatMessageTypeMessage) => void;
  toReplyMessage: ChatMessageTypeMessage | null;
  showReplyPreview: boolean;
  onCloseReplyPreview: () => void;
  getAuthorProfileImage: GetAuthorProfileImage;
  onMessageBubbleMenuClick: (
    e: React.MouseEvent<Element, MouseEvent>,
    message: ChatMessageTypeMessage
  ) => void;
}) {
  const conversationContainerRef = useRef<HTMLDivElement | null>(null);
  const chatReplyPreviewRef = useRef<HTMLDivElement | null>(null);

  return (
    <div className="relative h-full w-full overflow-y-hidden bg-gray-50">
      <div
        ref={conversationContainerRef}
        className="absolute h-full w-full transition-transform duration-200"
      >
        <div className="h-full w-full overflow-y-auto pb-2 pt-2">
          {props.chatItems.map((item) => (
            <ConversationItem
              key={item.seqId}
              item={item}
              getAuthorProfileImage={props.getAuthorProfileImage}
              onReplyMessage={() => {
                if (item.type === "message") {
                  props.onReplyMessage(item);
                  if (
                    conversationContainerRef.current &&
                    chatReplyPreviewRef.current
                  ) {
                    conversationContainerRef.current.style.transform = `translateY(-${chatReplyPreviewRef.current.clientHeight}px)`;
                  }
                }
              }}
              onMenuClick={(e) => {
                if (item.type === "message") {
                  props.onMessageBubbleMenuClick(e, item);
                }
              }}
            />
          ))}
        </div>
        <div
          ref={chatReplyPreviewRef}
          className={cx("border-t", {
            hidden: !props.showReplyPreview,
          })}
        >
          <div>
            {props.toReplyMessage !== null && (
              <ChatReplyPreview
                messageReplied={props.toReplyMessage}
                onClose={() => {
                  props.onCloseReplyPreview();
                  if (conversationContainerRef.current) {
                    conversationContainerRef.current.style.transform = `translateY(0)`;
                  }
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

type ChatReplyPreviewProps = {
  messageReplied: ChatMessageTypeMessage;
  onClose: () => void;
};

function ChatReplyPreview(props: ChatReplyPreviewProps) {
  return (
    <div id="chat-reply-preview" className="flex bg-gray-100 py-2 pl-4">
      <div className="w-[calc(100%-3rem)] rounded-[0.25rem] border-l-4 border-green-500 bg-gray-200/75 pl-2 text-sm text-gray-500">
        {match(props.messageReplied.text)
          .with({ type: "text" }, (t) => {
            return (
              <div className="py-2 pr-4">
                <p className="mb-1 text-green-600">
                  {props.messageReplied.userIsAuthor
                    ? "You"
                    : props.messageReplied.authorName}
                </p>
                <p className="max-h-10 overflow-hidden">{t.content}</p>
              </div>
            );
          })
          .with({ type: "file" }, (t) => {
            return (
              <div className="py-2 pr-4">
                <p className="mb-1 text-green-500">
                  {props.messageReplied.userIsAuthor
                    ? "You"
                    : props.messageReplied.authorName}
                </p>
                <div className="flex">
                  <div className="flex h-5 w-5 items-center justify-center">
                    <IconFile className="h-4 w-4 text-gray-400" />
                  </div>
                  <p className="ml-0.5 max-h-10 overflow-hidden whitespace-nowrap">
                    {t.filename == "" ? "File" : t.filename}
                  </p>
                </div>
              </div>
            );
          })
          .with({ type: "picture" }, (t) => {
            return (
              <div className="flex h-20 rounded-md">
                <div className="flex w-[calc(100%-5rem)] flex-col justify-center">
                  <p className="mb-1 text-green-500">
                    {props.messageReplied.userIsAuthor
                      ? "You"
                      : props.messageReplied.authorName}
                  </p>
                  <div className="flex pr-4">
                    <div className="flex h-5 w-5 items-center justify-center">
                      <IconCamera className="h-4 w-4 text-gray-500" />
                    </div>
                    <p className="ml-1 max-h-10 overflow-hidden whitespace-nowrap pr-1.5">
                      {t.caption == "" ? "Photo" : t.caption}
                    </p>
                  </div>
                </div>
                <div className="h-20 w-20 rounded-r-md bg-white">
                  <img src={t.url} className="h-full w-full rounded-r-md" />
                </div>
              </div>
            );
          })
          .run()}
      </div>
      <div className="w-12 pr-2.5">
        <button
          onClick={props.onClose}
          className="flex h-full w-full items-center justify-center"
        >
          <IconX className="h-5 w-5 text-gray-500/75" strokeWidth="3.5" />
        </button>
      </div>
    </div>
  );
}

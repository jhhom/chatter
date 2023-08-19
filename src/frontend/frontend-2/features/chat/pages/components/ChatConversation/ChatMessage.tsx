import type { ComponentProps } from "react";

import type { UserId } from "~/api-contract/subscription/subscription";
import type { Message } from "~/api-contract/subscription/subscription";

import {
  IconFile,
  IconChevronDown,
  IconForwardMessageArrow,
  IconCamera,
  IconBlock,
} from "~/frontend/frontend-2/features/common/icons";

import { LexicalRenderer } from "~/frontend/frontend-2/features/chat/pages/components/ChatConversation/lib/lexical";
import { clsx as cx } from "clsx";
import { match } from "ts-pattern";

export type ChatMessageDisplaySeq = "first" | "last" | "middle" | "single";

export type ChatMessageType = ChatMessageTypeMessage | ChatMessageTypeEventLog;

export type ChatMessageTypeMessage = {
  type: "message";
  authorId: UserId;
  authorName: string;
  seq: ChatMessageDisplaySeq;
  userIsAuthor: boolean;
  read: boolean;
  date: Date;
  isFirstOfDate: boolean;
  text: ChatBubbleMessageContent;
  seqId: number;
  deleted: boolean;
};

export type ChatMessageTypeEventLog = {
  type: "event_log";
  date: Date;
  isFirstOfDate: boolean;
  text: Message;
  seqId: number;
};

export type ChatBubbleMessageContent = Message & {
  replyTo: null | (Message & { seqId: number; authorName: string });
};

export type ChatMessageProps = (
  | {
      type: "message";
      authorId: string;
      authorName: string;
      seq: ChatMessageDisplaySeq;
      userIsAuthor: boolean;
      read: boolean;
      onImageClick: (imgUrl: string) => void;
      onMenuClick: ComponentProps<typeof MessageMenuButton>["onClick"];
      deleted: boolean;
      content: ChatBubbleMessageContent;
      onReplyMessageClick: () => void;
    }
  | {
      type: "event_log";
      content: Message;
    }
) & {
  date: Date;
  isFirstOfDate: boolean;
  seqId: number;
};

export function DeletedMessageContent() {
  return (
    <div className="flex">
      <div className="flex h-5 w-5 items-center justify-center p-0.5">
        <IconBlock className="text-gray-500" />
      </div>
      <p className="ml-1 italic text-gray-600">This message was deleted</p>
    </div>
  );
}

export function IconTick(props: { className?: string; fill?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill={"none"}
      viewBox="0 0 24 24"
      stroke-width="2.5"
      stroke={props.fill ?? "currentColor"}
      className={props.className ?? ""}
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M4.5 12.75l6 6 9-13.5"
      />
    </svg>
  );
}

function MessageMenuButton(props: {
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}) {
  return (
    <button onClick={props.onClick} className="h-5 w-5 rounded-md p-1">
      <IconChevronDown className="text-gray-500" strokeWidth="3.5" />
    </button>
  );
}

function IconDoubleTick(props: {
  className?: string;
  fill?: string;
  double?: boolean;
}) {
  return (
    <div className="flex">
      <IconTick className="h-3 w-3" fill={props.fill} />
      {props.double && (
        <IconTick className="-ml-[0.98rem] h-3 w-3" fill={props.fill} />
      )}
    </div>
  );
}

function IconRead(props: { read?: boolean }) {
  return props.read ? (
    <IconDoubleTick double fill="#60a5fa" />
  ) : (
    <IconDoubleTick fill="#6b7280" />
  );
}

function ReplyMessageContent(
  props: Message & { seqId: number; authorName: string } & {
    onReplyMessageClick: () => void;
  }
) {
  return (
    <div onClick={props.onReplyMessageClick} className="cursor-pointer">
      {match(props)
        .with({ type: "text" }, (m) => (
          <div className="rounded-[0.25rem] border-l-4 border-blue-500 bg-gray-200/75 px-2 py-2 text-[0.8rem] text-gray-500">
            <p className="mb-1.5 font-medium text-blue-500">{m.authorName}</p>
            <p className="max-h-14 overflow-hidden">{m.content}</p>
          </div>
        ))
        .with({ type: "picture" }, (m) => (
          <div className="h-[4.5rem] rounded-[0.25rem] border-l-4 border-blue-500 bg-gray-200/75 pl-2.5 text-[0.8rem] text-gray-500">
            <div className="flex h-full justify-between">
              <div className="flex h-full w-[calc(100%-3rem)] items-center pr-4">
                <div>
                  <p className="mb-1.5 font-medium text-blue-500">
                    {m.authorName}
                  </p>
                  <div className="flex h-6 overflow-hidden">
                    <div className="pt-0.5">
                      <IconCamera className="h-4 w-4 text-gray-500" />
                    </div>
                    <p className="ml-1">
                      {m.caption == "" ? "Photo" : m.caption}
                    </p>
                  </div>
                </div>
              </div>
              <div className="h-full w-12 overflow-hidden rounded-r-md">
                <img
                  src={m.url}
                  className="h-full w-full rounded-r-md object-scale-down"
                />
              </div>
            </div>
          </div>
        ))
        .with({ type: "file" }, (m) => (
          <div className="rounded-[0.25rem] border-l-4 border-blue-500 bg-gray-200/75 py-2 pl-2.5 pr-4 text-[0.8rem] text-gray-500">
            <p className="mb-1 text-blue-500">{m.authorName}</p>
            <div className="flex">
              <div className="flex h-5 w-5 items-center justify-center">
                <IconFile className="h-4 w-4 text-gray-400" />
              </div>
              <p className="ml-0.5 max-h-10 overflow-hidden whitespace-nowrap">
                {m.filename == "" ? "File" : m.filename}
              </p>
            </div>
          </div>
        ))
        .run()}
    </div>
  );
}

function ChatMessageContent(props: {
  content: ChatBubbleMessageContent;
  onImageClick: (url: string) => void;
  userIsWriter: boolean;
  onReplyMessageClick: () => void;
}) {
  return (
    <>
      {props.content.forwarded && (
        <div className="flex items-center pl-4 pr-2 pt-1">
          <IconForwardMessageArrow className="text-gray-400" />
          <p className="ml-1 italic text-gray-600">Forwarded</p>
        </div>
      )}
      {props.content.replyTo && (
        <div className="p-1 pb-0">
          <ReplyMessageContent
            onReplyMessageClick={props.onReplyMessageClick}
            {...props.content.replyTo}
          />
        </div>
      )}
      {match(props.content)
        .with({ type: "text" }, (m) => (
          <div className="px-4 pt-2">
            <LexicalRenderer content={m.content} />
          </div>
        ))
        .with({ type: "picture" }, (m) => (
          <div className="w-80">
            <div className="px-1 py-1">
              <img
                onClick={() => {
                  props.onImageClick(m.url);
                }}
                className="mb-2 max-h-[300px] w-80 cursor-pointer object-contain"
                src={m.url}
              />
            </div>
            <div className="px-2 py-1">
              <LexicalRenderer content={m.caption} />
            </div>
          </div>
        ))
        .with({ type: "file" }, (m) => (
          <div className="flex h-16 items-center rounded-md px-1">
            <a
              className={cx("flex h-14 items-center px-3", {
                "bg-gray-200": props.userIsWriter,
                "bg-green-300": !props.userIsWriter,
              })}
              target="_blank"
              href={m.url}
              download
            >
              <div className="mr-1.5 w-10 min-w-[2.5rem] text-gray-500">
                <IconFile className="" />
              </div>
              <div className="h-12 max-w-[250px] text-xs lg:max-w-[400px]">
                <p className="mt-1.5 overflow-hidden overflow-ellipsis whitespace-nowrap text-[0.85rem]">
                  {m.filename}
                </p>
                <p className="mt-1 text-[0.7rem]">PNG &#183; 4.3 MB</p>
              </div>
            </a>
          </div>
        ))
        .run()}
    </>
  );
}

function AuthoredChatMessage(props: {
  content: ChatBubbleMessageContent;
  read?: boolean;
  createdAt: Date;
  onImageClick: (url: string) => void;
  onMenuClick: ComponentProps<typeof MessageMenuButton>["onClick"];
  deleted: boolean;
  onReplyMessageClick: () => void;
}) {
  return (
    <div className="group relative ml-auto mt-1 w-fit max-w-[calc(100%-10%)] rounded-md bg-gray-50 text-[0.8rem]">
      {props.deleted ? (
        <div className="pl-2 pr-4 pt-2">
          <DeletedMessageContent />
        </div>
      ) : (
        <ChatMessageContent
          content={props.content}
          onImageClick={props.onImageClick}
          userIsWriter={true}
          onReplyMessageClick={props.onReplyMessageClick}
        />
      )}

      <div className="mt-0.5 flex justify-end px-4 pb-2">
        <p className="text-[0.7rem] font-light text-gray-500">
          {props.createdAt.toLocaleTimeString()}
        </p>
        <div
          className={cx("flex items-end justify-start pb-0.5", {
            "pl-1.5": props.read,
            "pl-0.5": !props.read,
          })}
        >
          <IconRead read={props.read ?? false} />
        </div>
      </div>
      <div className="absolute right-0 top-0 hidden group-hover:block">
        <MessageMenuButton onClick={props.onMenuClick} />
      </div>
    </div>
  );
}

function ReceivedChatMessage(props: {
  content: ChatBubbleMessageContent;
  createdAt: Date;
  onImageClick: (imgUrl: string) => void;
  onMenuClick: ComponentProps<typeof MessageMenuButton>["onClick"];
  deleted: boolean;
  onReplyMessageClick: () => void;
}) {
  return (
    <div className="group relative mt-1 w-fit max-w-[calc(100%-10%)] rounded-md bg-green-200 text-[0.8rem]">
      {props.deleted ? (
        <div className="pl-2 pr-4 pt-2">
          <DeletedMessageContent />
        </div>
      ) : (
        <ChatMessageContent
          content={props.content}
          onImageClick={props.onImageClick}
          userIsWriter={false}
          onReplyMessageClick={props.onReplyMessageClick}
        />
      )}
      <div className="mt-0.5 flex justify-end px-4 pb-2">
        <p className="text-[0.7rem] font-light text-gray-500">
          {props.createdAt.toLocaleTimeString()}
        </p>
      </div>
      <div className="absolute right-0 top-0 hidden group-hover:block">
        <MessageMenuButton onClick={props.onMenuClick} />
      </div>
    </div>
  );
}

function ChatMessage(props: ChatMessageProps) {
  return props.type == "message" ? (
    <div>
      {props.isFirstOfDate && (
        <div className="my-4 flex justify-center">
          <p className="bg-white text-center">{props.date.toDateString()}</p>
        </div>
      )}

      <div id={`message-${props.seqId}`}>
        {props.seq === "first" ||
          (props.seq === "single" && (
            <div
              className={cx("flex", {
                "justify-end": props.userIsAuthor,
              })}
            >
              <p
                className={cx("rounded-md bg-white px-2 py-1 text-sm", {
                  "bg-emerald-300": !props.userIsAuthor,
                })}
              >
                {props.authorName}
              </p>
            </div>
          ))}
        {props.userIsAuthor ? (
          <AuthoredChatMessage
            onImageClick={props.onImageClick}
            content={props.content}
            createdAt={props.date}
            read={props.read}
            onMenuClick={props.onMenuClick}
            deleted={props.deleted}
            onReplyMessageClick={props.onReplyMessageClick}
          />
        ) : (
          <ReceivedChatMessage
            content={props.content}
            onImageClick={props.onImageClick}
            createdAt={props.date}
            onMenuClick={props.onMenuClick}
            deleted={props.deleted}
            onReplyMessageClick={props.onReplyMessageClick}
          />
        )}
      </div>
    </div>
  ) : (
    <div>
      {props.isFirstOfDate && (
        <div className="my-4 flex justify-center">
          <p className="bg-white text-center">{props.date.toDateString()}</p>
        </div>
      )}
      <div className="my-1 flex justify-center">
        <p className="rounded-md bg-white px-4 py-0.5 text-center text-[0.825rem]">
          {props.content.type == "text" && props.content.content}
        </p>
      </div>
    </div>
  );
}

export { ChatMessage };

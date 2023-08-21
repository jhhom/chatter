import { useEffect, useRef, useState } from "react";
import { P, match } from "ts-pattern";

import {
  formatChatMessageDate,
  formatSeparatorDate,
  formatFileSize,
} from "~/frontend/frontend-2/features/chat/pages/components2/ChatConversation/utils";
import type { UserId, Message } from "~/api-contract/subscription/subscription";
import {
  IconEllipsisVertical,
  IconFile,
  IconCamera,
} from "~/frontend/frontend-2/features/common/icons";

import { clsx as cx } from "clsx";
import type {
  ChatBubbleMessageContent,
  ChatMessageType,
} from "~/frontend/frontend-2/features/chat/pages/components/ChatConversation/ChatMessage";
import { Tooltip, TooltipTrigger } from "@adobe/react-spectrum";

export function ConversationItem(props: {
  item: ChatMessageType;
  getAuthorProfileImage: (userId: UserId) => string | undefined;
  onReplyMessage: () => void;
}) {
  const [isUserHovering, setIsUserHovering] = useState(false);
  const [openChatMessageMenu, setOpenChatMessageMenu] = useState(false);

  return (
    <>
      {props.item.isFirstOfDate && (
        <div className="flex-center flex items-center py-5">
          ow
          <div className="ml-4 flex-1 border-b border-gray-300" />
          <p className="rounded-full border border-gray-300 px-2.5 py-0.5 text-xs font-medium text-gray-400">
            {formatSeparatorDate(props.item.date)}
          </p>
          <div className="mr-4 flex-1 border-b border-gray-300" />
        </div>
      )}
      {props.item.type === "event_log" && (
        <div className="chat_event_log py-1 text-center text-xs text-gray-500">
          <p>{props.item.text.type === "text" && props.item.text.content}</p>
        </div>
      )}
      {props.item.type === "message" && (
        <div
          onMouseEnter={() => {
            setIsUserHovering(true);
          }}
          onMouseLeave={() => {
            setIsUserHovering(false);
          }}
          className={cx("chat_message flex pl-2", {
            "justify-end": props.item.userIsAuthor,
            "mb-2": props.item.seq === "first" || props.item.seq === "middle",
            "mb-4": props.item.seq === "last" || props.item.seq === "single",
          })}
        >
          <div
            className={cx("flex", {
              "justify-end":
                props.item.type === "message" &&
                props.item.userIsAuthor &&
                props.item.text.type === "text",
            })}
          >
            <div
              className={cx("w-[3.25rem] pl-2 pr-3", {
                "order-last": props.item.userIsAuthor,
              })}
            >
              {props.item.seq === "first" ||
                (props.item.seq === "single" && (
                  <img
                    className="inline-block h-8 w-8 rounded-md object-cover"
                    src={props.getAuthorProfileImage(props.item.authorId)}
                  />
                ))}
            </div>

            <div
              className={cx("w-fit rounded-md pb-1", {
                "bg-green-100": props.item.userIsAuthor,
                "bg-white": !props.item.userIsAuthor,
                "max-w-[280px] sm:max-w-[80%] md:max-w-[60%]":
                  props.item.type === "message" &&
                  props.item.text.type === "text",
              })}
            >
              {props.item.seq === "first" ||
                (props.item.seq === "single" && (
                  <div className="flex items-end pl-4 pr-3 pt-1 text-[13px]">
                    <p className="font-medium text-black">
                      {props.item.authorName}
                    </p>
                  </div>
                ))}

              <div>
                {match(props.item.text)
                  .with({ type: "text" }, (c) => (
                    <MessageText
                      {...c}
                      addTopPadding={
                        props.item.type === "message" &&
                        (!(
                          props.item.seq === "first" ||
                          props.item.seq === "single"
                        ) ||
                          props.item.text.replyTo !== null)
                      }
                    />
                  ))
                  .with({ type: "picture" }, (c) => (
                    <MessageWithPicture {...c} />
                  ))
                  .with({ type: "file" }, (c) => <MessageWithFile {...c} />)
                  .exhaustive()}
              </div>
            </div>

            <div
              className={cx(
                "flex flex-col justify-between text-[11px] text-gray-500",
                {
                  "order-first pr-2": props.item.userIsAuthor,
                  "pl-2": !props.item.userIsAuthor,
                }
              )}
            >
              <div
                className={cx("flex", {
                  "justify-end": props.item.userIsAuthor,
                })}
              >
                {isUserHovering ||
                  (openChatMessageMenu && (
                    <TooltipTrigger>
                      <button className="h-7 w-7 rounded-md border-[1.5px] border-gray-300 bg-white p-1">
                        <IconEllipsisVertical className="text-gray-600" />
                      </button>
                      <Tooltip>
                        <p className="px-1 py-0.5 text-xs text-gray-600">
                          Menu
                        </p>
                      </Tooltip>
                    </TooltipTrigger>
                  ))}
              </div>
              <div>
                {props.item.userIsAuthor && props.item.read && (
                  <p className="text-right">Read</p>
                )}
                <p className="flex justify-end">
                  {formatChatMessageDate(props.item.date)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ReplyMessage(
  props: Message & {
    seqId: number;
    authorName: string;
  }
) {
  return match(props)
    .with({ type: "text" }, (i) => (
      <div className="cursor-pointer rounded-[0.25rem] border-l-4 border-gray-500/20 bg-gray-500/10 text-[0.8rem] text-gray-500">
        <div className="pb-1.5 pl-3 pr-2 pt-1">
          <div className="mb-0.5">
            <p className="overflow-x-auto whitespace-nowrap pr-3 text-gray-500">
              Reply to {i.authorName}
            </p>
          </div>
          <p className="line-clamp-3 overflow-hidden">{i.content}</p>
        </div>
      </div>
    ))
    .with({ type: "file" }, (i) => (
      <div className="cursor-pointer rounded-[0.25rem] border-l-4 border-gray-500/20 bg-gray-500/10 pl-2.5 text-[0.8rem] text-gray-500">
        <div className="mb-0.5 pb-3 pt-1.5">
          <p className="overflow-x-auto whitespace-nowrap pr-3 text-gray-500">
            Reply to {i.authorName}
          </p>
        </div>
        <div className="flex pb-3.5">
          <div className="flex h-5 w-5 items-center justify-center">
            <IconFile className="h-4 w-4 text-gray-500" />
          </div>
          <p className="ml-0.5 max-h-10 overflow-x-hidden text-ellipsis whitespace-nowrap pr-3">
            {i.filename == "" ? "File" : i.filename}
          </p>
        </div>
      </div>
    ))
    .with({ type: "picture" }, (i) => {
      return (
        <div className="h-[4.5rem] cursor-pointer rounded-[0.25rem] border-l-4 border-gray-500/20 bg-gray-500/10 pl-2.5 text-[0.8rem] text-gray-500">
          <div className="flex h-full justify-between">
            <div className="flex h-full w-[calc(100%-3rem)] pr-4">
              <div className="pt-1.5">
                <div className="mb-0.5">
                  <p className="overflow-x-auto whitespace-nowrap pr-3 text-gray-500">
                    Reply to {i.authorName}
                  </p>
                </div>
                <div className="flex h-10 items-center overflow-hidden">
                  <div className="pt-0.5">
                    <IconCamera className="h-4 w-4 text-gray-500" />
                  </div>
                  <p className="ml-1 line-clamp-1">
                    {i.caption == "" ? "Photo" : i.caption}
                  </p>
                </div>
              </div>
            </div>
            <div className="h-full w-12 overflow-hidden rounded-r-md">
              <img
                src={i.url}
                className="h-full w-full rounded-r-md object-cover"
              />
            </div>
          </div>
        </div>
      );
    })
    .exhaustive();
}

export type ImageDisplayMode = "square" | "landscape" | "portrait";

function ChatImage(props: {
  src: string;
  imgDisplayMode: ImageDisplayMode;
  setImgDisplayMode: (mode: ImageDisplayMode) => void;
  hasCaption: boolean;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);

  const landscape = "w-[330px] max-h-[200px] min-h-[100px]";
  const portrait = "w-[150px] max-h-[300px] min-h-[80px]";
  const square = "w-[200px] h-[200px]";

  const portraitWithCaption = "w-[220px] max-h-[300px] min-h-[80px]";

  useEffect(() => {
    const r = imgRef.current;
    if (r) {
      r.onload = () => {
        const aspectRatio = r.naturalWidth / r.naturalHeight;

        if (aspectRatio > 1.1) {
          props.setImgDisplayMode("landscape");
        } else if (aspectRatio < 1) {
          props.setImgDisplayMode("portrait");
        }
      };
    }
  }, [props.setImgDisplayMode]);

  return (
    <div>
      <img
        ref={imgRef}
        className={cx("cursor-pointer rounded-md object-cover", {
          [portraitWithCaption]:
            props.imgDisplayMode === "portrait" && props.hasCaption,
          [landscape]: props.imgDisplayMode === "landscape",
          [portrait]: props.imgDisplayMode === "portrait" && !props.hasCaption,
          [square]: props.imgDisplayMode === "square",
        })}
        src={props.src}
      />
    </div>
  );
}

function MessageWithPicture(
  props: Extract<ChatBubbleMessageContent, { type: "picture" }>
) {
  const [imgDisplayMode, setImageDisplayMode] =
    useState<ImageDisplayMode>("square");

  const landscape = "w-[330px]";
  const portrait = "w-[150px]";
  const portraitWithCaption = "w-[220px]";
  const square = "w-[200px]";

  return (
    <div
      className={cx("pt-1", {
        [landscape]: imgDisplayMode === "landscape",
        [portrait]: imgDisplayMode === "portrait" && props.caption === "",
        [portraitWithCaption]:
          imgDisplayMode === "portrait" && props.caption !== "",
        [square]: imgDisplayMode === "square",
      })}
    >
      {props.replyTo !== null && (
        <div
          className={cx("mb-1 px-1", {
            [landscape]: imgDisplayMode === "landscape",
            [portrait]: imgDisplayMode === "portrait" && props.caption === "",
            [portraitWithCaption]:
              imgDisplayMode === "portrait" && props.caption !== "",
            [square]: imgDisplayMode === "square",
          })}
        >
          <ReplyMessage {...props.replyTo} />
        </div>
      )}
      <div className="px-1">
        <div>
          <ChatImage
            imgDisplayMode={imgDisplayMode}
            setImgDisplayMode={setImageDisplayMode}
            hasCaption={props.caption !== ""}
            src={props.url}
          />
        </div>
        {props.caption !== "" && (
          <div className="px-3 pb-1.5 pt-2">
            <p className="text-[13px] text-gray-600">{props.caption}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function MessageWithFile(
  props: Extract<ChatBubbleMessageContent, { type: "file" }>
) {
  return (
    <div className="w-[280px] rounded-md pt-1">
      {props.replyTo !== null && (
        <div className="mb-1 px-1">
          <ReplyMessage {...props.replyTo} />
        </div>
      )}
      <div className="mx-1 flex cursor-pointer rounded-md bg-gray-500/10 px-2 pb-2.5 pt-1.5">
        <div className="flex h-10 items-center justify-center px-1">
          <IconFile className="h-8 w-8 text-gray-400" />
        </div>
        <div className="ml-1 mt-1 w-[100%-2.5rem] overflow-hidden">
          <p className="line-clamp-2 text-[0.825rem]">
            {props.filename == "" ? "File" : props.filename}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {formatFileSize(props.size)}
          </p>
        </div>
      </div>
    </div>
  );
}

function MessageText(
  props: Extract<ChatBubbleMessageContent, { type: "text" }> & {
    addTopPadding: boolean;
  }
) {
  return (
    <div
      className={cx("pb-1", {
        "pt-1": props.addTopPadding,
      })}
    >
      {props.replyTo !== null && (
        <div className="mb-1 px-1 ">
          <ReplyMessage {...props.replyTo} />
        </div>
      )}
      <p className="px-4 text-[13px] text-gray-600">{props.content}</p>
    </div>
  );
}

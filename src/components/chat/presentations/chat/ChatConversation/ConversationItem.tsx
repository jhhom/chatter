import React from "react";
import { HoverProps, useHover } from "react-aria";
import clsx from "clsx";
import { match } from "ts-pattern";
import { Popover, OverlayArrow, Dialog } from "react-aria-components";

import {
  FileReply,
  PictureReply,
  TextReply,
} from "~/components/experiments/chat/ChatConversation/ChatMessage";
import { TooltipButton } from "~/components/experiments/chat/ChatConversation/Tooltip";
import {
  IconCircleCheck,
  IconCircle,
  IconEllipsisVertical,
} from "~/components/experiments/chat/Icons";
import { ChatMessageMessage } from "~/components/experiments/chat/types";

export function ConversationItem(
  props: {
    seqId: number;
    children: JSX.Element;
    date: Date;
    onHoverStart: HoverProps["onHoverStart"];
    onHoverEnd: HoverProps["onHoverEnd"];
    showMessageMenu: boolean;
    replyTo: ChatMessageMessage["content"]["replyTo"];
  } & (
    | {
        userIsAuthor: true;
        read: boolean;
      }
    | {
        userIsAuthor: false;
      }
  )
) {
  const { hoverProps, isHovered } = useHover({
    onHoverStart: props.onHoverStart,
    onHoverEnd: props.onHoverEnd,
  });
  const [isOpen, setOpen] = React.useState(false);
  const triggerRef = React.useRef<null | HTMLButtonElement>(null);

  return (
    <div
      className={clsx("my-2 flex w-full", {
        "justify-end": props.userIsAuthor,
      })}
      {...hoverProps}
    >
      {/* read checkmark */}
      {props.userIsAuthor && (
        <div className="order-1 mr-1.5 flex items-end pb-0.5">
          <div className="mx-auto mt-auto h-3.5 w-3.5 text-primary-500">
            {props.read ? <IconCircleCheck /> : <IconCircle />}
          </div>
        </div>
      )}

      {/* content */}
      <div
        className={clsx("order-2 max-w-[80%] rounded-md", {
          "bg-gray-100": !props.userIsAuthor,
          "bg-primary-100": props.userIsAuthor,
        })}
      >
        {/* reply content */}
        {props.replyTo &&
          match(props.replyTo)
            .with({ type: "file" }, (c) => (
              <FileReply
                content={c.caption}
                userIsWriter={props.userIsAuthor}
              />
            ))
            .with({ type: "picture" }, (c) => (
              <PictureReply
                content={c.caption}
                pictureUrl={c.url}
                userIsWriter={props.userIsAuthor}
              />
            ))
            .with({ type: "text" }, (c) => (
              <TextReply
                content={c.content}
                userIsWriter={props.userIsAuthor}
              />
            ))
            .exhaustive()}
        <div>{props.children}</div>
        <div className="mt-2 flex w-full justify-end px-2 pb-2 text-xs text-gray-500">
          <p>00:00 am</p>
        </div>
      </div>

      {/* message menu */}
      <div
        className={clsx("flex items-center px-1.5", {
          "order-0": props.userIsAuthor,
          "order-3": !props.userIsAuthor,
          invisible: !props.showMessageMenu,
        })}
      >
        <TooltipButton
          ref={triggerRef}
          tooltip="Menu"
          onClick={() => setOpen(true)}
        >
          <IconEllipsisVertical className="h-[1rem] w-[1rem] text-gray-500/80" />
        </TooltipButton>
      </div>

      {/* date */}

      <Popover
        className=""
        isOpen={isOpen}
        arrowSize={10}
        placement="top"
        onOpenChange={(open) => {
          setOpen(open);
        }}
        triggerRef={triggerRef}
      >
        <OverlayArrow>
          <svg width={12} height={12}>
            <path d="M0 0,L6 6,L12 0" />
          </svg>
        </OverlayArrow>
        <Dialog className="flex w-32 flex-col rounded-md border border-gray-200 bg-white p-2 text-sm  shadow-xl">
          <button className="w-full rounded-md py-2 pl-3 text-left hover:bg-gray-100">
            Remove
          </button>
          <button className="w-full rounded-md py-2  pl-3 text-left hover:bg-gray-100">
            Forward
          </button>
        </Dialog>
      </Popover>
    </div>
  );
}

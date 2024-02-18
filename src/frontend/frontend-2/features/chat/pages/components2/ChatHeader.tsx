import { useState, useRef, useEffect } from "react";
import {
  IconPerson,
  IconEllipsisVertical,
} from "~/frontend/frontend-2/features/common/icons";
import { isToday, format, isYesterday } from "date-fns";
import { clsx as cx } from "clsx";

const MenuItem = (props: { content: string; onClick?: () => void }) => {
  return (
    <div>
      <button
        onClick={props.onClick}
        className="w-full cursor-pointer py-2 pl-3 text-left hover:bg-gray-100"
      >
        {props.content}
      </button>
    </div>
  );
};

const indicatorText = (
  online: boolean,
  typing: string | null,
  lastSeen: Date | null
): string | undefined => {
  if (online) {
    if (typing) {
      return `${typing} is typing...`;
    } else {
      return "online";
    }
  } else if (lastSeen !== null) {
    if (isToday(lastSeen)) {
      return `last seen today at ${format(lastSeen, "h:mm aa")}`;
    } else if (isYesterday(lastSeen)) {
      return `last seen yesterday at ${format(lastSeen, "h:mm aa")}`;
    } else {
      return `last seen ${format(lastSeen, "MMM dd, yyyy")}`;
    }
  } else {
    return undefined;
  }
};

export function PastGroupChatHeader(props: {
  groupName: string;
  groupProfilePhotoUrl?: string;
  onInfoClick: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClick: Parameters<
      typeof document.body.addEventListener<"click">
    >[1] = (e) => {
      if (e.target instanceof Node && !menuRef.current?.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.body.addEventListener("click", onClick);

    return () => document.body.addEventListener("click", onClick);
  }, []);

  return (
    <div className="flex h-16 w-full items-center justify-between border-b-[1.5px] border-gray-200 px-5">
      <div className="flex items-center">
        <div className="relative h-10 w-10">
          {props.groupProfilePhotoUrl ? (
            <img
              className="inline-block h-10 w-10 rounded-lg"
              src={props.groupProfilePhotoUrl}
            />
          ) : (
            <div className="flex h-10 w-10 items-end justify-center rounded-lg bg-gray-100 pb-1">
              <IconPerson className="h-7 w-7 text-gray-400" />
            </div>
          )}
        </div>

        <div className="pl-3">
          <p className="font-medium">{props.groupName}</p>
        </div>
      </div>

      <div className="pr-2">
        <button
          onClick={() => {
            setShowMenu(!showMenu);
          }}
          className="h-10 w-10 rounded-md p-2 hover:bg-gray-100"
        >
          <IconEllipsisVertical className="h-6 w-6" />
        </button>

        <div
          className={cx(
            { hidden: !showMenu },
            // "absolute right-5 z-10 w-36 bg-white py-2 text-sm shadow-md"
            "absolute right-5 z-10 w-[150px] rounded-md border-[1.5px] border-gray-300 bg-white py-2 text-sm"
          )}
          ref={menuRef}
        >
          <MenuItem
            content="Info"
            onClick={() => {
              setShowMenu(false);
              props.onInfoClick();
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function ChatHeader(props: {
  type: "p2p" | "grp";
  online: boolean;
  lastSeen: Date | null;
  typing: string | null;
  contactName: string;
  contactProfilePhotoUrl?: string;
  onInfoClick: () => void;
  onClearMessages: () => void;
  onBlock?: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClick: Parameters<
      typeof document.body.addEventListener<"click">
    >[1] = (e) => {
      if (e.target instanceof Node && !menuRef.current?.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.body.addEventListener("click", onClick);

    return () => document.body.addEventListener("click", onClick);
  }, []);

  const profileDescription = indicatorText(
    props.online,
    props.typing,
    props.lastSeen
  );

  return (
    <div className="flex h-16 w-full items-center justify-between border-b-[1.5px] border-gray-200 px-5">
      <div className="flex items-center">
        <div className="relative h-10 w-10">
          {props.contactProfilePhotoUrl ? (
            <img
              className="inline-block h-10 w-10 rounded-lg object-cover"
              src={props.contactProfilePhotoUrl}
            />
          ) : (
            <div className="flex h-10 w-10 items-end justify-center rounded-lg bg-gray-100 pb-1">
              <IconPerson className="h-7 w-7 text-gray-400" />
            </div>
          )}

          {props.online && (
            <div className="absolute -right-1 -top-1 h-3 w-3 rounded-sm bg-white p-[0.1rem]">
              <div className="h-full w-full rounded-sm bg-green-400/80" />
            </div>
          )}
        </div>

        <div className="pl-3">
          <p className="font-medium">{props.contactName}</p>
          {profileDescription && (
            <p className="text-xs text-gray-600">{profileDescription}</p>
          )}
        </div>
      </div>

      <div className="pr-2">
        <button
          onClick={() => {
            setShowMenu(!showMenu);
          }}
          className="h-10 w-10 rounded-md p-2 hover:bg-gray-100"
        >
          <IconEllipsisVertical className="h-6 w-6" />
        </button>

        <div
          className={cx(
            { hidden: !showMenu },
            // "absolute right-5 z-10 w-36 bg-white py-2 text-sm shadow-md"
            "absolute right-5 z-10 w-[150px] rounded-md border-[1.5px] border-gray-300 bg-white py-2 text-sm"
          )}
          ref={menuRef}
        >
          <MenuItem
            content="Info"
            onClick={() => {
              setShowMenu(false);
              props.onInfoClick();
            }}
          />
          <MenuItem
            onClick={() => {
              setShowMenu(false);
              props.onClearMessages();
            }}
            content="Clear messages"
          />
          {props.type === "p2p" && (
            <MenuItem
              onClick={() => {
                if (props.onBlock) {
                  props.onBlock();
                }
                setShowMenu(false);
              }}
              content="Block"
            />
          )}
        </div>
      </div>
    </div>
  );
}

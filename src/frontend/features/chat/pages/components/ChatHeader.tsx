import { useState, useEffect, useRef } from "react";
import { DateTime } from "luxon";
import clsx from "clsx";

import { IconEllipsisVertical } from "~/frontend/features/common/icons";

export type ChatHeaderProps = {
  name: string;
  online: boolean;
  lastSeen: Date | null;
  onInfoClick: () => void;
  typing: string | null;
  profilePhotoUrl: string | null;
  type: "group" | "p2p";
  onBlock?: () => void;
  onClearMessages: () => void;
};

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

export function ChatHeader(props: ChatHeaderProps) {
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
    <div className="flex h-14 items-center bg-gray-300 px-4">
      <div className="flex h-full w-full items-center justify-between">
        <div className="flex h-full items-center">
          <div className="relative h-9 w-9">
            <img
              src={
                props.profilePhotoUrl ??
                "https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Google_Images_2015_logo.svg/2880px-Google_Images_2015_logo.svg.png"
              }
              className="h-full w-full rounded-full object-cover"
            />
            {props.online && (
              <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500" />
            )}
          </div>
          <div className="ml-2">
            <p className="text">{props.name}</p>
            {props.online ? (
              props.typing ? (
                <p className="text-xs">{props.typing} is typing...</p>
              ) : (
                <p className="text-xs">online now</p>
              )
            ) : (
              props.lastSeen && (
                <p className="text-xs">
                  Last seen:{" "}
                  {DateTime.fromJSDate(props.lastSeen).toFormat("LLL dd, T")}
                </p>
              )
            )}
          </div>
        </div>

        <div className="relative h-full w-10">
          <button
            onClick={() => {
              setShowMenu(!showMenu);
            }}
            className="flex h-full w-full items-center justify-center rounded-md"
          >
            <IconEllipsisVertical className="h-6 w-6" />
          </button>

          <div
            className={clsx(
              { hidden: !showMenu },
              "absolute right-5 z-10 w-36 bg-white py-2 text-sm shadow-md"
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
              <MenuItem onClick={props.onBlock} content="Block" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

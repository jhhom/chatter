import { useState } from "react";
import clsx from "clsx";

import { IconEllipsisVertical } from "~/frontend/features/common/icons";

export function ChatHeader(props: {
  name: string;
  onInfoClick: () => void;
  profilePhotoUrl: string | null;
}) {
  const [showMenu, setShowMenu] = useState(false);

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

  return (
    <div className="flex h-14 items-center bg-gray-300 px-4">
      <div className="flex h-full w-full items-center justify-between">
        <div className="flex h-full items-center">
          <img
            src={
              props.profilePhotoUrl ??
              "https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Google_Images_2015_logo.svg/2880px-Google_Images_2015_logo.svg.png"
            }
            className="h-9 w-9 rounded-full object-cover"
          />
          <div className="ml-2">
            <p className="text">{props.name}</p>
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
              "absolute right-5 z-10 w-36 bg-white py-2 text-sm shadow-md",
              { hidden: !showMenu }
            )}
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
    </div>
  );
}

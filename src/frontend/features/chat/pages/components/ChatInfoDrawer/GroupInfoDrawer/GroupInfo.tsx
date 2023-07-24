import { useState, useEffect, useRef } from "react";
import clsx from "clsx";
import {
  IconShield,
  IconAddPerson,
  IconChevronDown,
  IconLink,
  IconLeaveGroup,
} from "~/frontend/features/common/icons";

import type {
  GroupTopicId,
  UserId,
} from "~/api-contract/subscription/subscription";
import { permission } from "~/backend/service/common/permissions";

type GroupInfoProps = {
  profile: {
    name: string;
    id: GroupTopicId;
    ownerId: UserId;
    userId: UserId;
  };
  memberList: {
    name: string;
    online: boolean;
    userId: UserId;
    profilePhotoUrl: string | null;
  }[];
  onLeaveGroup: () => void;
  onAddMemberClick: () => void;
  onSecurityClick: () => void;
  onInviteToGroupClick: () => void;
  permissions: string;
  onContactRemove: (removedUserId: UserId) => void;
  onEditPermissions: (userId: UserId) => void;
  onViewPermissions: (userId: UserId) => void;
  canInvite: boolean;
};

export function GroupInfo(props: GroupInfoProps) {
  const canAdminister = permission(props.permissions).canAdminister();

  return (
    <div>
      <div className="bg-white pb-3">
        <div className="flex justify-center py-2">
          <div className="h-32 w-32">
            <img
              className="h-full w-full rounded-full"
              src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Tour_Eiffel_Wikimedia_Commons_%28cropped%29.jpg/640px-Tour_Eiffel_Wikimedia_Commons_%28cropped%29.jpg"
            />
          </div>
        </div>

        <div className="px-2 text-sm">
          <div>
            <p className="text-blue-600">Name</p>
            <p>{props.profile.name}</p>
          </div>
          <div className="mt-4">
            <p>ID: {props.profile.id}</p>
          </div>
        </div>
      </div>

      <button
        onClick={props.onSecurityClick}
        className="mt-1.5 flex w-full bg-white px-2 py-3 hover:bg-gray-100"
      >
        <div className="mr-0.5">
          <IconShield height={20} className="text-[#3b82f6]" />
        </div>
        <p className="text-left text-sm text-blue-600">SECURITY</p>
      </button>

      <button
        onClick={props.onLeaveGroup}
        className="mt-1.5 flex w-full bg-white px-2 py-3 hover:bg-gray-100"
      >
        <div className="mr-1.5">
          <IconLeaveGroup className="h-5 w-5 text-red-600" />
        </div>
        <p className="text-left text-sm text-red-600">LEAVE CONVERSATION</p>
      </button>

      <div className="mt-1.5 bg-white pt-1.5">
        <p className="pl-2 text-sm text-blue-500">Group members:</p>
        <div className="mt-2.5">
          <button
            onClick={props.onAddMemberClick}
            className="flex w-full items-center py-2 pl-2 text-sm hover:bg-gray-100"
          >
            <div>
              <IconAddPerson fill="#3b82f6" height={24} />
            </div>
            <p className="pl-2 text-left text-sm text-blue-500">ADD MEMBERS</p>
          </button>
        </div>
        <div className="mt-2">
          <button
            onClick={props.onInviteToGroupClick}
            className="flex w-full items-center py-2 pl-2 text-sm hover:bg-gray-100"
          >
            <div>
              <IconLink className="h-6 text-blue-500" />
            </div>
            <p className="pl-2 text-left text-sm text-blue-500">
              INVITE TO GROUP VIA LINK
            </p>
          </button>
        </div>

        <div className="mt-3">
          {props.memberList.map((m) => (
            <InfoMemberListContact
              name={m.name}
              profilePhotoUrl={m.profilePhotoUrl}
              permissions={props.permissions}
              onViewPermissions={() => props.onViewPermissions(m.userId)}
              onEditPermissions={
                m.userId !== props.profile.userId && canAdminister
                  ? () => props.onEditPermissions(m.userId)
                  : undefined
              }
              onRemove={
                m.userId !== props.profile.userId && canAdminister
                  ? () => props.onContactRemove(m.userId)
                  : undefined
              }
              isOwner={props.profile.ownerId === m.userId}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function InfoMemberListContact(props: {
  name: string;
  profilePhotoUrl: string | null;
  permissions: string;
  onViewPermissions: () => void;
  onRemove?: () => void;
  onEditPermissions?: () => void;
  isOwner: boolean;
}) {
  const [openMenu, setOpenMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClick: Parameters<
      typeof document.body.addEventListener<"click">
    >[1] = (e) => {
      if (e.target instanceof Node && !menuRef.current?.contains(e.target)) {
        setOpenMenu(false);
      }
    };

    return () => {
      document.body.removeEventListener("click", onClick);
    };
  }, []);

  return (
    <div
      onClick={() => {
        setOpenMenu(!openMenu);
      }}
      className="relative flex cursor-pointer justify-between py-2 pl-2 pr-4 hover:bg-gray-100"
    >
      <div className="flex">
        <div className="h-12 w-12">
          <img
            className="h-full w-full rounded-full object-cover"
            src={
              props.profilePhotoUrl ??
              "https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Tour_Eiffel_Wikimedia_Commons_%28cropped%29.jpg/640px-Tour_Eiffel_Wikimedia_Commons_%28cropped%29.jpg"
            }
          />
        </div>
        <div className="pl-2">
          <p className="text-sm">
            {props.name}
            {props.isOwner && ` (Owner)`}
          </p>
        </div>
      </div>
      <div className="">
        <IconChevronDown className="h-4 w-4" />
      </div>

      <div
        className={clsx(
          "absolute -bottom-14 right-10 z-10 w-36 bg-white py-2 text-sm shadow-md",
          {
            hidden: !openMenu,
          }
        )}
        ref={menuRef}
      >
        {!permission(props.permissions).canAdminister() ||
        props.isOwner ||
        (props.onRemove === undefined &&
          props.onEditPermissions === undefined) ? (
          <MenuItem
            content="View permissions"
            onClick={props.onViewPermissions}
          />
        ) : (
          <>
            {props.onRemove && (
              <MenuItem content="Remove" onClick={props.onRemove} />
            )}
            {props.onEditPermissions && (
              <MenuItem
                content="Edit permissions"
                onClick={props.onEditPermissions}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

const MenuItem = (props: { content: string; onClick?: () => void }) => {
  return (
    <div className="">
      <button
        onClick={props.onClick}
        className="w-full cursor-pointer py-2 pl-3 text-left hover:bg-gray-100"
      >
        {props.content}
      </button>
    </div>
  );
};

import { useState } from "react";
import { match } from "ts-pattern";

import {
  IconX,
  IconShield2,
  IconLink,
  IconPlus,
  IconLeaveGroup,
  IconChevronDown,
  IconPerson,
} from "~/frontend/frontend-2/features/common/icons";
import { DrawerContentSecurity } from "./DrawerContentSecurity";
import { DrawerContentInviteLink } from "./DrawerContentInviteLink";
import { DrawerButton } from "./components";
import { DrawerContentAddMembersToGroup } from "./DrawerContentAddMembersToGroup";

import { permission } from "~/backend/service/common/permissions";

import {
  Popover,
  OverlayArrow,
  Dialog,
  TooltipTrigger,
  Tooltip,
  Button,
  DialogTrigger,
} from "react-aria-components";
import type {
  GroupTopicId,
  UserId,
} from "~/api-contract/subscription/subscription";

export function DrawerContentInfo(props: {
  groupName: string;
  groupId: GroupTopicId;
  groupOwnerId: UserId;
  userId: UserId;
  userPermissions: string;
  profilePhotoUrl: string | null;
  memberList: {
    name: string;
    online: boolean;
    userId: UserId;
    profilePhotoUrl: string | null;
  }[];
  onLeaveGroup: () => void;
  onSecurityClick: () => void;
  onInviteLinkClick: () => void;
  onAddMemberClick: () => void;
  onContactRemove: (removedUserId: UserId) => void;
  onEditPermissions: (userId: UserId) => void;
  onViewPermissions: (userId: UserId) => void;
  canInvite: boolean;
}) {
  const canAdminister = permission(props.userPermissions).canAdminister();

  return (
    <div>
      <div className="pb-3 pt-4">
        <div className="flex justify-center py-2">
          <div className="h-14 w-14">
            {props.profilePhotoUrl ? (
              <img
                className="h-full w-full rounded-lg"
                src={props.profilePhotoUrl}
              />
            ) : (
              <div className="flex h-full w-full items-end justify-center rounded-lg bg-gray-100 pb-1">
                <IconPerson className="h-9 w-9 text-gray-400" />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="pt-1">
        <p className="text-center font-medium">{props.groupName}</p>
        <p className="mt-3 text-center text-sm text-gray-500">
          ID: {props.groupId}
        </p>
      </div>

      <div className="mb-10 mt-8 text-sm">
        <div className="w-full space-y-4 px-4">
          <DrawerButton
            content="Security"
            icon={<IconShield2 height={20} className="text-gray-500" />}
            iconPadding="px-2"
            onClick={props.onSecurityClick}
          />
          <DrawerButton
            content="Invite to group via link"
            icon={<IconLink className="text-gray-500" />}
            iconPadding="px-2"
            onClick={props.onInviteLinkClick}
          />
          <DrawerButton
            content="Add members to group"
            icon={<IconPlus className="text-gray-500" />}
            iconPadding="px-2.5"
            onClick={props.onAddMemberClick}
          />
        </div>
      </div>

      <div className="px-4 text-sm">
        <div className="flex justify-between">
          <p className="border-gray-400  font-medium">Group members (10)</p>
        </div>

        <div className="mt-5">
          <ul className="space-y-5">
            {props.memberList.map((m) => {
              return (
                <MemberListContact
                  key={m.userId}
                  name={m.name}
                  online={m.online}
                  profilePhotoUrl={m.profilePhotoUrl}
                  userId={m.userId}
                  isOwnSelf={m.userId === props.userId}
                  onViewPermissions={() => props.onViewPermissions(m.userId)}
                  onEditPermissions={
                    m.userId !== props.userId && canAdminister
                      ? () => props.onEditPermissions(m.userId)
                      : undefined
                  }
                  onRemove={
                    m.userId !== props.userId && canAdminister
                      ? () => props.onContactRemove(m.userId)
                      : undefined
                  }
                  isOwner={props.groupOwnerId === m.userId}
                  canEditPermission={canAdminister}
                />
              );
            })}
          </ul>
        </div>
      </div>

      <div className="my-6 px-4">
        <hr className="border-t border-gray-300" />
      </div>

      <div className="px-4">
        <button className="group mt-3 flex h-12 w-full cursor-pointer items-center justify-between rounded-md border border-red-400 pl-4 text-left text-gray-600 hover:bg-red-500">
          <p className="text-sm text-red-600 group-hover:text-white">
            LEAVE CONVERSATION
          </p>
          <div className="mr-2 flex h-full w-10 items-center justify-center rounded-md px-2">
            <IconLeaveGroup className="text-red-500 group-hover:text-white" />
          </div>
        </button>
      </div>
    </div>
  );
}

function MemberListContact(props: {
  name: string;
  online: boolean;
  userId: UserId;
  isOwnSelf: boolean;
  profilePhotoUrl: string | null;
  canEditPermission: boolean;
  onViewPermissions: () => void;
  onRemove?: () => void;
  onEditPermissions?: () => void;
  isOwner: boolean;
}) {
  return (
    <li className="group flex cursor-pointer items-center justify-between rounded-lg">
      <div className="flex items-center">
        <div className="h-9 w-9">
          {props.profilePhotoUrl ? (
            <img
              className="h-full w-full rounded-lg object-cover"
              src={props.profilePhotoUrl}
            />
          ) : (
            <div className="flex h-full w-full items-end justify-center rounded-lg bg-gray-100 pb-1">
              <IconPerson className="h-6 w-6 text-gray-400" />
            </div>
          )}
        </div>
        <p className="pl-3">{props.name}</p>
      </div>

      <DialogTrigger>
        <TooltipTrigger>
          <Button className="block h-8 w-8 rounded-md  px-2 hover:bg-gray-50 hover:outline hover:outline-2 hover:outline-gray-200">
            <IconChevronDown className="text-gray-500" />
          </Button>
          <Tooltip offset={5}>
            <p className="rounded-md border bg-white px-1 py-0.5 text-xs text-gray-600">
              Menu
            </p>
          </Tooltip>
        </TooltipTrigger>
        <Popover arrowSize={10}>
          <OverlayArrow>
            <svg width={12} height={12}>
              <path d="M0 0,L6 6,L12 0" />
            </svg>
          </OverlayArrow>
          <Dialog className="rounded-md border border-gray-200 bg-white py-2 text-sm">
            {props.canEditPermission &&
            props.onEditPermissions &&
            !props.isOwner &&
            !props.isOwnSelf ? (
              <>
                <MemberListContactMenuItem
                  content="Edit permissions"
                  onClick={props.onEditPermissions}
                />
                <MemberListContactMenuItem
                  content="Remove"
                  onClick={props.onRemove}
                />
              </>
            ) : (
              <MemberListContactMenuItem
                content="View permissions"
                onClick={props.onViewPermissions}
              />
            )}
          </Dialog>
        </Popover>
      </DialogTrigger>
    </li>
  );
}

function MemberListContactMenuItem(props: {
  content: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={props.onClick}
      className="block w-full px-4 py-2 text-left hover:bg-gray-100"
    >
      {props.content}
    </button>
  );
}

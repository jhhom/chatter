import { useState } from "react";
import { match } from "ts-pattern";

import {
  IconX,
  IconShield2,
  IconLink,
  IconPlus,
  IconLeaveGroup,
  IconChevronDown,
} from "~/frontend/frontend-2/features/common/icons";
import { DrawerContentSecurity } from "./DrawerContentSecurity";
import { DrawerContentInviteLink } from "./DrawerContentInviteLink";
import { DrawerButton } from "./components";
import { DrawerContentAddMembersToGroup } from "./DrawerContentAddMembersToGroup";

import {
  Popover,
  OverlayArrow,
  Dialog,
  TooltipTrigger,
  Tooltip,
} from "react-aria-components";
import { DialogTrigger } from "@adobe/react-spectrum";

const groupMembers: {
  profilePicSrc: string;
  username: string;
}[] = [
  {
    profilePicSrc: "./assets/girl-1.jpg",
    username: "Anna Smith",
  },
  {
    profilePicSrc: "./assets/girl-2.jpg",
    username: "Mary Lamb",
  },
  {
    profilePicSrc: "./assets/girl-3.jpg",
    username: "Jessica James",
  },
  {
    profilePicSrc: "./assets/man-9-[asian].jpg",
    username: "Paul Mark",
  },
  {
    profilePicSrc: "./assets/man-3-[white].jpg",
    username: "James Parker",
  },
];

export function GrpInfoDrawer2() {
  const [content, setContent] = useState<
    "info" | "security" | "invite-link" | "add-member"
  >("info");

  return (
    <div className="h-full overflow-y-auto">
      <DrawerHeader
        title={match(content)
          .with("info", () => "Info")
          .with("invite-link", () => "Invite link")
          .with("security", () => "Security")
          .with("add-member", () => "Add member")
          .exhaustive()}
        onClose={() => {
          if (content !== "info") {
            setContent("info");
          } else {
          }
        }}
      />

      <div className="h-[calc(100%-4rem)]">
        {match(content)
          .with("security", () => (
            <DrawerContentSecurity
              onBack={() => setContent("info")}
              hasPermissionToEdit={false}
            />
          ))
          .with("invite-link", () => <DrawerContentInviteLink />)
          .with("add-member", () => <DrawerContentAddMembersToGroup />)
          .otherwise(() => (
            <DrawerContentInfo
              onSecurityClick={() => setContent("security")}
              onInviteLinkClick={() => setContent("invite-link")}
              onAddMemberClick={() => setContent("add-member")}
            />
          ))}
      </div>
    </div>
  );
}

function DrawerHeader(props: { title: string; onClose: () => void }) {
  return (
    <div className="flex h-16 items-center justify-between border-b border-gray-300 px-4">
      <p>{props.title}</p>
      <button
        onClick={props.onClose}
        className="h-10 w-10 rounded-md p-2.5 hover:bg-gray-100"
      >
        <IconX />
      </button>
    </div>
  );
}

function DrawerContentInfo(props: {
  onSecurityClick: () => void;
  onInviteLinkClick: () => void;
  onAddMemberClick: () => void;
}) {
  return (
    <div>
      <div className="bg-white pb-3 pt-4">
        <div className="flex justify-center py-2">
          <div className="h-14 w-14">
            <img
              className="h-full w-full rounded-lg"
              src="./assets/abstract-art.jpg"
            />
          </div>
        </div>
      </div>

      <div className="pt-1">
        <p className="text-center font-medium">Designers Team</p>
        <p className="mt-3 text-center text-sm text-gray-500">
          ID: grpv0gv99eytynq
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
            {groupMembers.map((m) => (
              <li className="group flex cursor-pointer items-center justify-between rounded-lg">
                <div className="flex items-center">
                  <div className="h-9 w-9">
                    <img
                      className="h-full w-full rounded-lg object-cover"
                      src={m.profilePicSrc}
                    />
                  </div>
                  <p className="pl-3">{m.username}</p>
                </div>

                <DialogTrigger>
                  <TooltipTrigger>
                    <button className="block h-8 w-8 rounded-md bg-white px-2 hover:border-2 hover:bg-gray-50">
                      <IconChevronDown className="text-gray-500" />
                    </button>
                    <Tooltip>
                      <p className="px-1 py-0.5 text-xs text-gray-600">Menu</p>
                    </Tooltip>
                  </TooltipTrigger>
                  <Popover>
                    <OverlayArrow>
                      <svg width={12} height={12}>
                        <path d="M0 0,L6 6,L12 0" />
                      </svg>
                    </OverlayArrow>
                    <Dialog>
                      <button className="block w-full px-4 py-2 text-left hover:bg-gray-100">
                        Remove
                      </button>
                      <button className="block w-full px-4 py-2 text-left hover:bg-gray-100">
                        Edit permissions
                      </button>
                    </Dialog>
                  </Popover>
                </DialogTrigger>
              </li>
            ))}
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
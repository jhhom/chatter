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
import { DrawerContentAddMembersToGroup } from "./DrawerContentAddMembersToGroup";
import { DrawerContentInfo } from "~/frontend/frontend-2/features/chat/pages/components2/Drawers/GrpInfoDrawer/DrawerContentInfo";

import { DrawerButton } from "./components";

import {
  Popover,
  OverlayArrow,
  Dialog,
  TooltipTrigger,
  Tooltip,
} from "react-aria-components";
import type { UserId } from "~/api-contract/subscription/subscription";
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

type Content =
  | "info"
  | "security"
  | "invite-link"
  | "add-member"
  | "member-security";

export function GroupInfoDrawer3(props: {
  onClose: () => void;
  children: (props: {
    content: Content;
    checkingOutMember: UserId | null;
    setContent: (content: Content) => void;
    setCheckingOutMember: (userId: UserId | null) => void;
    memberSecurityContentEditable: boolean;
    setMemberSecurityContentEditable: (editable: boolean) => void;
  }) => JSX.Element;
}) {
  const [content, setContent] = useState<Content>("info");
  const [checkingOutMember, setCheckingOutMember] = useState<UserId | null>(
    null
  );
  const [memberSecurityContentEditable, setMemberSecurityContentEditable] =
    useState(false);

  return (
    <div className="h-full overflow-y-auto">
      <DrawerHeader
        title={match(content)
          .with("info", () => "Info")
          .with("invite-link", () => "Invite link")
          .with("security", () => "Security")
          .with("add-member", () => "Add member")
          .with("member-security", () => "Member security")
          .exhaustive()}
        onClose={() => {
          if (content !== "info") {
            setContent("info");
          } else {
            props.onClose();
          }
        }}
      />

      <div className="h-[calc(100vh-4rem)] flex-grow overflow-y-auto bg-gray-50">
        <div className="h-full">
          {props.children({
            content: content,
            setContent,
            checkingOutMember: checkingOutMember,
            setCheckingOutMember,
            memberSecurityContentEditable: memberSecurityContentEditable,
            setMemberSecurityContentEditable,
          })}
        </div>
      </div>
    </div>
  );
}

function DrawerHeader(props: { title: string; onClose: () => void }) {
  return (
    <div className="flex h-16 items-center justify-between border-b border-l border-gray-300 px-4">
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

export {
  DrawerHeader,
  DrawerContentSecurity,
  DrawerContentInviteLink,
  DrawerContentAddMembersToGroup,
  DrawerContentInfo,
};

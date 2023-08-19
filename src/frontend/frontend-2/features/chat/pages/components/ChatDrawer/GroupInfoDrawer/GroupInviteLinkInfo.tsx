import Link from "next/link";
import { useState, useEffect } from "react";
import {
  IconCopy,
  IconStop,
  IconForwardMessageArrow,
} from "~/frontend/frontend-2/features/common/icons";

export const GroupInviteLinkInfo = ({
  getInviteLink,
  ...props
}: {
  groupId: string;
  groupName: string;
  getInviteLink: () => Promise<string>;
  resetInviteLink: () => void;
  onCopyInviteLink: () => void;
}) => {
  const [inviteLink, setInviteLink] = useState("");

  useEffect(() => {
    void getInviteLink().then((link) =>
      setInviteLink(`http://localhost:4000/join_group/${link}`)
    );
  }, [getInviteLink]);

  return (
    <div className="h-full bg-white">
      <div className="flex items-center space-x-4 px-6 py-4">
        <div>
          <div className="h-20 w-20 rounded-full bg-gray-200" />
        </div>
        <div>
          <p className="text-lg">{props.groupName}</p>
          <Link className="mt-1 text-sm text-blue-500" href={inviteLink}>
            {inviteLink}
          </Link>
        </div>
      </div>

      <p className="bg-gray-100 px-6 py-4 text-sm text-gray-700">
        Anyone with Tinode can follow this link to join this group. Only share
        it with people you trust.
      </p>

      <div>
        <div>
          <GroupInviteLinkButton
            icon={<IconForwardMessageArrow className="h-5 w-5 text-gray-400" />}
            text={"Send link via Tinode"}
          />
          <GroupInviteLinkButton
            onClick={() => {
              void navigator.clipboard.writeText(inviteLink);
              props.onCopyInviteLink();
            }}
            icon={<IconCopy className="h-5 w-5 text-gray-400" />}
            text={"Copy link"}
          />
          <GroupInviteLinkButton
            icon={<IconStop className="h-5 w-5 text-gray-400" />}
            text={"Reset link"}
          />
        </div>
      </div>
    </div>
  );
};

const GroupInviteLinkButton = (props: {
  icon: JSX.Element;
  text: string;
  onClick?: () => void;
}) => {
  return (
    <button
      onClick={props.onClick}
      className="flex w-full items-center space-x-6 hover:bg-gray-100"
    >
      <div className="w-[1.25rem] px-6 py-4">{props.icon}</div>
      <div className="flex h-full w-[calc(100%-1.25rem)] items-center border-b border-gray-200 py-4">
        <p className="self-end">{props.text}</p>
      </div>
    </button>
  );
};

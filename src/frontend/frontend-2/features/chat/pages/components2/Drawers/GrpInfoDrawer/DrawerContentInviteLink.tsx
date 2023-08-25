import Link from "next/link";
import { useEffect, useState } from "react";

import {
  IconCopy,
  IconExclamationCircle,
  IconStop,
  IconPerson,
} from "~/frontend/frontend-2/features/common/icons";
import { DrawerButton } from "./components";

export function DrawerContentInviteLink(props: {
  groupProfilePhotoUrl: string | undefined;
  groupId: string;
  groupName: string;
  getInviteLink: () => Promise<string>;
  resetInviteLink: () => void;
  onCopyInviteLink: () => void;
}) {
  const [inviteLink, setInviteLink] = useState("");

  useEffect(() => {
    void props.getInviteLink().then((l) => {
      setInviteLink(`http://localhost:4000/join_group/${l}`);
    });
  }, [props.getInviteLink]);

  return (
    <div className="h-full bg-white px-6 pt-4">
      <div className="pb-3">
        <div className="flex py-2">
          <div className="h-14 w-14">
            {props.groupProfilePhotoUrl ? (
              <img
                className="h-full w-full rounded-lg"
                src={props.groupProfilePhotoUrl}
              />
            ) : (
              <div className="flex h-full w-full items-end justify-center rounded-lg bg-gray-100 pb-1">
                <IconPerson className="h-10 w-10 text-gray-400" />
              </div>
            )}
          </div>

          <div className="w-[calc(100%-3.5rem)] pl-4 text-sm">
            <p className="font-medium">{props.groupName}</p>
            <Link
              className="mt-1.5 block text-[0.8rem] text-blue-600 hover:text-blue-700 hover:underline"
              href={inviteLink}
            >
              {inviteLink}
            </Link>
          </div>
        </div>

        <div className="mt-4 flex rounded-md bg-orange-100 px-4 py-2 text-[0.8rem]">
          <IconExclamationCircle className="mr-3 w-12 text-orange-400" />
          <p>
            Anyone with Tinode can follow this link to join this group. Only
            share it with people you trust.
          </p>
        </div>

        <div className="mt-6 text-sm">
          <DrawerButton
            content="Copy link"
            icon={<IconCopy className="text-gray-400" />}
            iconPadding="px-2.5"
            onClick={() => {
              void navigator.clipboard.writeText(inviteLink);
              props.onCopyInviteLink();
            }}
          />
        </div>

        <div className="mt-4 text-sm">
          <DrawerButton
            content="Reset link"
            icon={<IconStop className="text-gray-400" />}
            iconPadding="px-2.5"
            onClick={props.resetInviteLink}
          />
        </div>
      </div>
    </div>
  );
}

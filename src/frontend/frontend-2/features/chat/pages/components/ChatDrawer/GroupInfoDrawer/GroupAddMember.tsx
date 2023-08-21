import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  UserId,
  GroupTopicId,
} from "~/api-contract/subscription/subscription";

import { IconX } from "~/frontend/frontend-2/features/common/icons";
import { clsx as cx } from "clsx";

export type NewMember = {
  userId: UserId;
  userFullname: string;
  profilePhotoUrl: string | null;
};

export function GroupAddMember(props: {
  groupTopicId: GroupTopicId;
  onAddMembers: (membersToAdd: UserId[]) => Promise<unknown>;
  searchNewMembersByName: (query: string) => Promise<NewMember[]>;
  onCancelClick: () => void;
  onAfterMembersAdded: () => void;
}) {
  const [addedMembers, setAddedMembers] = useState<NewMember[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [newMemberSearchList, setNewMemberSearchList] = useState<NewMember[]>(
    []
  );

  useEffect(() => {
    void props
      .searchNewMembersByName(searchInput)
      .then((v) => setNewMemberSearchList(v));
  }, [searchInput, props]);

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex h-full flex-col pt-4">
        <div className="h-60 px-4">
          <p className="mb-2">Group Members</p>
          <div className="h-40 w-full overflow-y-auto border border-black pl-1 pt-1">
            <div className="flex flex-wrap items-start justify-start gap-x-1 gap-y-1">
              {addedMembers.map((m) => (
                <ContactPill
                  userId={m.userId}
                  name={m.userFullname}
                  removable={true}
                  onRemove={(userId) => {
                    setAddedMembers((members) =>
                      members.filter((x) => x.userId != userId)
                    );
                    setNewMemberSearchList((list) =>
                      list.concat([
                        {
                          userFullname: m.userFullname,
                          userId,
                          profilePhotoUrl: m.profilePhotoUrl,
                        },
                      ])
                    );
                  }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="flex h-24 w-full flex-wrap items-center px-4">
          <div className="w-full pt-4">
            <p>Contact Search:</p>
            <input
              type="text"
              className="mt-2 block w-full rounded-md border border-gray-800 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-blue-500"
              onChange={(e) => {
                setSearchInput(e.target.value);
              }}
            />
          </div>
        </div>
        <div className="flex h-24 w-full items-center px-4">
          <p>All Contacts</p>
        </div>
        <div className="h-[calc(100%-12rem-10rem-3rem)] flex-grow overflow-y-auto">
          {newMemberSearchList.map((m) => (
            <Contact
              name={m.userFullname}
              profilePhotoUrl={m.profilePhotoUrl}
              onClick={() => {
                setAddedMembers([...addedMembers, m]);
                setNewMemberSearchList(
                  newMemberSearchList.filter((x) => x.userId != m.userId)
                );
              }}
            />
          ))}
        </div>
        <div className="flex h-12 items-center justify-around bg-gray-200">
          <button
            onClick={props.onCancelClick}
            className="h-7 rounded-sm bg-white px-4 text-blue-400 shadow-md"
          >
            CANCEL
          </button>
          <button
            onClick={async () => {
              const added = addedMembers;
              if (added.length == 0) {
                return;
              }
              await props.onAddMembers(added.map((u) => u.userId));
              props.onAfterMembersAdded();
            }}
            className="h-7 rounded-sm bg-blue-500 px-4 text-white shadow-md"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

function ContactPill(
  props: { name: string; userId: UserId } & (
    | {
        removable: false;
      }
    | {
        removable: true;
        onRemove: (userId: UserId) => void;
      }
  )
) {
  return (
    <div className="inline-block rounded-full bg-gray-200 text-xs">
      <div className="flex items-center">
        <div className="h-6 w-6 rounded-full bg-orange-300"></div>
        <p
          className={cx("py-1 pl-1", {
            "pr-1": props.removable,
            "pr-1.5": !props.removable,
          })}
        >
          {props.name}
        </p>
        {props.removable && (
          <button
            onClick={() => {
              if (props.removable) {
                props.onRemove(props.userId);
              }
            }}
            className="mr-1 h-5 w-5 rounded-full bg-gray-400"
          >
            <IconX className="h-full w-full text-white" />
          </button>
        )}
      </div>
    </div>
  );
}

function Contact(props: {
  name: string;
  profilePhotoUrl: string | null;
  onClick: () => void;
}) {
  return (
    <button
      onClick={() => props.onClick()}
      className="block h-[3.75rem] w-full cursor-pointer border-0 border-b border-gray-200 pt-1 hover:bg-gray-100"
    >
      <div className="flex pl-4">
        <div className="h-12 w-12">
          <img
            className="h-full w-full rounded-full object-cover"
            src={
              props.profilePhotoUrl ??
              "https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Tour_Eiffel_Wikimedia_Commons_%28cropped%29.jpg/720px-Tour_Eiffel_Wikimedia_Commons_%28cropped%29.jpg"
            }
          />
        </div>
        <div className="pl-2">
          <p className="text-sm">{props.name}</p>
        </div>
      </div>
    </button>
  );
}

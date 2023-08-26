import { useState, useEffect } from "react";
import { ContactSearch } from "~/frontend/frontend-2/features/common/components";
import { IconPerson } from "~/frontend/frontend-2/features/common/icons";
import type {
  GroupTopicId,
  UserId,
} from "~/api-contract/subscription/subscription";

export type NewMember = {
  userId: UserId;
  userFullname: string;
  profilePhotoUrl: string | null;
};

export function DrawerContentAddMembersToGroup(props: {
  groupTopicId: GroupTopicId;
  onAddMembers: (membersToAdd: UserId[]) => void;
  searchNewMembersByName: (query: string) => Promise<NewMember[]>;
  onCancelClick: () => void;
  onAfterMembersAdded: () => void;
}) {
  const [addedMembers, setAddedMembers] = useState<
    { userId: UserId; userFullname: string; profilePhotoUrl: string | null }[]
  >([]);
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
    <div className="h-full bg-white text-sm">
      <div className="pt-6">
        <div className="px-4">
          <p className="font-medium">Add participant</p>

          <div className="mt-3 flex h-40 w-full flex-wrap content-start justify-start gap-y-2 overflow-y-auto rounded-md border  border-gray-400 px-2 py-2">
            {addedMembers.map((c) => (
              <AddedContactPill
                userId={c.userId}
                userFullname={c.userFullname}
                profilePhotoUrl={c.profilePhotoUrl}
                onRemove={() =>
                  setAddedMembers(
                    addedMembers.filter((x) => x.userId !== c.userId)
                  )
                }
              />
            ))}
          </div>
        </div>

        <div className="mt-8">
          <div className="px-4">
            <p className="font-medium">Contact Search</p>

            <div className="mt-3">
              <ContactSearch onInput={(e) => setSearchInput(e.target.value)} />
            </div>
          </div>
        </div>

        <p className="mb-4 mt-8 px-4">
          Contacts ({newMemberSearchList.length})
        </p>
        <div className="pl-20 pr-4 pt-1">
          <hr />
        </div>
      </div>

      <div className="h-[calc(100%-(24.375rem+4rem))] overflow-y-auto">
        {newMemberSearchList
          .filter(
            (m) => addedMembers.findIndex((x) => x.userId === m.userId) === -1
          )
          .map((c) => (
            <div
              onClick={() => setAddedMembers([...addedMembers, c])}
              className="group hover:bg-gray-100"
            >
              <Contact
                name={c.userFullname}
                picture={c.profilePhotoUrl ?? undefined}
              />

              <div className="pl-20 pr-4 pt-1">
                <hr />
              </div>
            </div>
          ))}
      </div>

      <div className="flex h-16 w-full items-center justify-around border-l border-t-2 border-gray-200">
        <button
          onClick={props.onCancelClick}
          className="block rounded-md border border-gray-300 px-4 py-2 hover:bg-gray-50"
        >
          Cancel
        </button>

        <button
          onClick={() => {
            const added = addedMembers;
            if (added.length == 0) {
              return;
            }
            props.onAddMembers(added.map((u) => u.userId));
            props.onAfterMembersAdded();
          }}
          className="block rounded-md bg-green-600/80 px-4 py-2 font-medium text-white hover:bg-green-600"
        >
          Add members
        </button>
      </div>
    </div>
  );
}

function AddedContactPill(
  props: NewMember & {
    onRemove: () => void;
  }
) {
  return (
    <div className="ml-1.5 flex h-6 rounded-md border border-gray-300 bg-gray-100">
      <div className="h-full w-8 rounded-l-md">
        {props.profilePhotoUrl ? (
          <img
            className="h-full w-full rounded-l-md object-cover"
            src={props.profilePhotoUrl}
          />
        ) : (
          <div className="flex h-full items-end justify-center rounded-l-md object-cover">
            <IconPerson className="h-5 w-5 text-gray-400" />
          </div>
        )}
      </div>
      <div className="ml-1.5 flex items-center whitespace-nowrap pr-1 text-xs">
        {props.userFullname}
      </div>
      <div className="group p-0.5">
        <button
          onClick={props.onRemove}
          className="flex h-full w-6 items-center justify-center rounded-md bg-red-500 text-white group-hover:bg-red-400"
        >
          <IconX2 className="w-4" />
        </button>
      </div>
    </div>
  );
}

function Contact(props: { name: string; picture: string | undefined }) {
  return (
    <div className="flex cursor-pointer items-center px-4 py-2 ">
      <div className="relative w-10">
        {props.picture ? (
          <img
            className="inline-block h-10 w-10 rounded-lg object-cover"
            src={props.picture}
          />
        ) : (
          <div className="flex h-10 w-10 items-end justify-center rounded-lg bg-gray-100 pb-1">
            <IconPerson className="h-7 w-7 text-gray-400" />
          </div>
        )}
      </div>

      <div className="flex h-10 w-[calc(100%-2.5rem)] items-center pl-6">
        <p className="text-sm">{props.name}</p>
      </div>
    </div>
  );
}

function IconX2(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      fill="currentColor"
      className={props.className}
    >
      <path d="m254-159-94-95 225-226-225-226 94-96 226 226 226-226 94 96-225 226 225 226-94 95-226-226-226 226Z" />
    </svg>
  );
}

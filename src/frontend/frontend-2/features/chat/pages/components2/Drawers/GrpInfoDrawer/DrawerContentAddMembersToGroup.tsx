import { useState } from "react";
import { IconX } from "~/frontend/frontend-2/features/common/icons";
import { ContactSearch } from "~/frontend/frontend-2/features/common/components";

type Contact = {
  id: string;
  name: string;
  picture: string;
};

const contactList: Contact[] = [
  {
    id: "1",
    name: "John Graham",
    picture: "./assets/man-1-[white].jpg",
  },
  {
    id: "2",
    name: "Designer team",
    picture: "./assets/abstract-art.jpg",
  },
  {
    id: "3",
    name: "Denis Jakubow",
    picture: "./assets/man-6-[white].jpg",
  },
  {
    id: "4",
    name: "Samantha Mathew",
    picture: "./assets/girl-1.jpg",
  },
  {
    id: "4",
    name: "Samantha Mathew",
    picture: "./assets/girl-1.jpg",
  },
  {
    id: "4",
    name: "Samantha Mathew",
    picture: "./assets/girl-1.jpg",
  },
  {
    id: "4",
    name: "Samantha Mathew",
    picture: "./assets/girl-1.jpg",
  },
  {
    id: "4",
    name: "Samantha Mathew",
    picture: "./assets/girl-1.jpg",
  },
  {
    id: "4",
    name: "Samantha Mathew",
    picture: "./assets/girl-1.jpg",
  },
  {
    id: "4",
    name: "Samantha Mathew",
    picture: "./assets/girl-1.jpg",
  },
  {
    id: "3",
    name: "Denis Jakubow",
    picture: "./assets/man-6-[white].jpg",
  },
];

export function DrawerContentAddMembersToGroup() {
  const [search, setSearch] = useState("");
  const [addedContacts, setAddedContacts] = useState<Contact[]>([]);

  const filteredContacts = contactList
    .filter((x) => x.name.toLowerCase().includes(search.toLowerCase()))
    .filter(
      (x) => addedContacts.findIndex((added) => added.id === x.id) === -1
    );

  // 1.5rem + 1.25rem + 10rem + 2rem + 1.25rem + 0.75rem + 1.5rem + 2rem + 1.25rem + 0.25rem +

  return (
    <div className="h-full text-sm">
      <div className="pt-6">
        <div className="px-4">
          <p className="font-medium">Add participant</p>

          <div className="mt-3 flex h-40 w-full flex-wrap content-start justify-start gap-y-2 overflow-y-auto rounded-md border  border-gray-400 px-2 py-2">
            {addedContacts.map((c) => (
              <AddedContactPill
                id={c.id}
                name={c.name}
                picture={c.picture}
                onRemove={() =>
                  setAddedContacts(addedContacts.filter((x) => x.id !== c.id))
                }
              />
            ))}
          </div>
        </div>

        <div className="mt-8">
          <div className="px-4">
            <p className="font-medium">Contact Search</p>

            <div className="mt-3">
              <ContactSearch onInput={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </div>

        <p className="mb-4 mt-8 px-4">Contacts ({filteredContacts.length})</p>
        <div className="pl-20 pr-4 pt-1">
          <hr />
        </div>
      </div>

      <div className="h-[calc(100%-(24.375rem+4rem))] overflow-y-auto">
        {filteredContacts.map((c) => (
          <div
            onClick={() => setAddedContacts([...addedContacts, c])}
            className="group hover:bg-gray-100"
          >
            <Contact name={c.name} picture={c.picture} />

            <div className="pl-20 pr-4 pt-1">
              <hr />
            </div>
          </div>
        ))}
      </div>

      <div className="flex h-16 w-full items-center justify-around border-t-2 border-gray-200">
        <button className="block rounded-md border border-gray-300 px-4 py-2 hover:bg-gray-50">
          Cancel
        </button>

        <button className="block rounded-md bg-green-600/80 px-4 py-2 font-medium text-white hover:bg-green-600">
          Add members
        </button>
      </div>
    </div>
  );
}

function AddedContactPill(
  props: Contact & {
    onRemove: () => void;
  }
) {
  return (
    <div className="ml-1.5 flex h-6 rounded-md border border-gray-300 bg-gray-100">
      <div className="h-full w-8 rounded-l-md">
        <img
          src={props.picture}
          className="h-full w-full rounded-l-md object-cover"
        />
      </div>
      <div className="ml-1.5 flex items-center whitespace-nowrap pr-1 text-xs">
        {props.name}
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

function Contact(props: { name: string; picture: string }) {
  return (
    <div className="flex cursor-pointer items-center px-4 py-2 ">
      <div className="relative w-10">
        <img
          className="inline-block h-10 w-10 rounded-lg object-cover"
          src={props.picture}
        />
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
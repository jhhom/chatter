import { ContactSearch } from "~/frontend/frontend-2/features/common/components";
import { useRef, useState, forwardRef, createRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "~/frontend/stores/stores";
import type { ServiceOutput, ServiceResult } from "~/api-contract/types";
import { client } from "~/frontend/external/api-client/client";
import { IconPerson } from "~/frontend/frontend-2/features/common/icons";

export function TabFindContact(props: {
  search: string;
  setSearch: (s: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const store = useAppStore((s) => ({
    contact: {
      grp: s.grp,
      p2p: s.p2p,
      newContacts: s.newContacts,
      set: s.setContact,
    },
    profile: s.profile,
    get: s.get,
  }));

  const query = useQuery({
    queryKey: ["contacts", searchQuery],
    queryFn: async () => {
      const result = await client["users/find_users_to_add_as_contact"]({
        email: searchQuery,
      });
      if (result.isErr()) {
        throw result.error;
      }

      return result.value;
    },
  });

  const filteredUsers = (() => {
    const topics = Array.from(store.contact.p2p.keys()).concat(
      Array.from(store.contact.newContacts.keys())
    );

    return (
      query.data?.filter((u) => {
        return (
          topics.find((t) => t === u.id) === undefined &&
          u.id !== store.profile.profile?.userId
        );
      }) ?? []
    );
  })();

  return (
    <div className="h-full">
      <div className="h-9 px-4">
        <ContactSearch onInput={(e) => props.setSearch(e.target.value)} />
      </div>

      <div className="mt-4 h-[calc(100%-(3.25rem))] space-y-3 overflow-y-auto">
        {filteredUsers
          .filter((c) => c.fullname.toLowerCase().includes(props.search))
          .map((c) => (
            <Contact
              onClick={() =>
                store.contact.set((s) => {
                  s.newContacts.set(c.id, {
                    name: c.fullname,
                    description: c.email,
                    touchedAt: new Date(),
                    userPermissions: c.defaultPermissions,
                    profilePhotoUrl: c.profilePhotoUrl,
                    lastMessage: null,
                  });
                })
              }
              key={c.id}
              name={c.fullname}
              picture={c.profilePhotoUrl}
            />
          ))}
      </div>
    </div>
  );
}

function Contact(props: {
  name: string;
  picture: string | null;
  onClick: () => void;
}) {
  return (
    <div
      onClick={props.onClick}
      className="flex cursor-pointer items-center px-5 py-2 hover:bg-gray-100"
    >
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

      <div className="flex h-10 w-[calc(100%-2.5rem)] items-center pl-3.5">
        <div className="flex items-end justify-between">
          <p className="text-sm font-medium">{props.name}</p>
        </div>
      </div>
    </div>
  );
}

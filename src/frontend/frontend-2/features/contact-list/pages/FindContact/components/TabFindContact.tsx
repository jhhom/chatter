import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ServiceOutput } from "~/api-contract/types";
import type { IApiClient } from "~/api-contract/client";
import type { UserId } from "~/api-contract/subscription/subscription";

import { ContactSearch } from "~/frontend/frontend-2/features/common/components";
import { IconPerson } from "~/frontend/frontend-2/features/common/icons";

export function TabFindContact(props: {
  userId: UserId;
  existingContacts: UserId[];
  findUsersToAddAsContact: IApiClient["users/find_users_to_add_as_contact"];
  onAddContact: (
    contact: ServiceOutput<"users/find_users_to_add_as_contact">[number]
  ) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const query = useQuery({
    queryKey: ["contacts", searchQuery],
    queryFn: async () => {
      const result = await props.findUsersToAddAsContact({
        email: searchQuery,
      });
      if (result.isErr()) {
        throw result.error;
      }

      // filter out the users who are already our existing contact, and also filter out ourself
      // the reason we cannot perform this filter on the server
      // is because new contacts is only added on the client-side, and doesn't store anything on the server
      return (
        result.value.filter((u) => {
          return (
            props.existingContacts.find((t) => t === u.id) === undefined &&
            u.id !== props.userId
          );
        }) ?? []
      );
    },
  });

  return (
    <div className="h-full">
      <div className="h-9 px-4">
        <ContactSearch onInput={(e) => setSearchQuery(e.target.value)} />
      </div>

      <div className="mt-4 h-[calc(100%-(3.25rem))] space-y-3 overflow-y-auto">
        {query.data
          ?.filter((c) => c.fullname.toLowerCase().includes(searchQuery))
          .map((c) => (
            <Contact
              onClick={() => props.onAddContact(c)}
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

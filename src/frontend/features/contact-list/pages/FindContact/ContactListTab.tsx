import {
  IconBlock,
  IconGroup,
  IconSearch,
} from "~/frontend/features/common/icons";
import type { UserId } from "~/api-contract/subscription/subscription";
import { permission } from "~/backend/service/common/permissions";

type Contact = {
  userId: UserId;
  userPermission: string;
  username: string;
  fullname: string;
  email: string;
  profilePhotoUrl: string | null;
};

export default function ContactListTab(props: {
  onSearchEnter: (query: string) => void;
  contactList: Contact[];
  onContactClick: (user: Contact) => void;
}) {
  return (
    <div>
      <div className="mt-3 px-3">
        <SearchContactInput onEnter={(q) => props.onSearchEnter(q)} />
      </div>

      <div className="mt-2.5">
        {props.contactList.map((c) => (
          <ContactListContact
            key={c.userId}
            username={c.username}
            description={c.email}
            onClick={() => props.onContactClick(c)}
            hasJoinPermission={permission(c.userPermission).canJoin()}
            profilePhotoUrl={c.profilePhotoUrl}
          />
        ))}
      </div>
    </div>
  );
}

function SearchContactInput(props: { onEnter: (inputValue: string) => void }) {
  return (
    <div className="relative flex w-full">
      <div className="absolute bottom-2.5 flex items-center justify-center">
        <div className="h-4 w-4">
          <IconSearch />
        </div>
      </div>
      <input
        className="block w-full border-b-[1.5px] border-gray-400 py-1.5 pl-5 text-sm text-gray-400 focus:border-blue-400 focus:outline-none"
        type="text"
        placeholder="List like email:alice@example.com"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            props.onEnter(e.currentTarget.value);
          }
        }}
      />
    </div>
  );
}

export function ContactListContact(props: {
  username: string;
  description?: string;
  isGroup?: boolean;
  onClick: () => void;
  hasJoinPermission?: boolean;
  profilePhotoUrl: string | null;
}) {
  return (
    <div
      onClick={props.onClick}
      className="flex cursor-pointer items-center border-b border-gray-200 py-2 pl-1.5 hover:bg-gray-100"
    >
      <div className="h-10 w-10 rounded-full bg-white">
        <img
          src={
            props.profilePhotoUrl ??
            "https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Google_Images_2015_logo.svg/2880px-Google_Images_2015_logo.svg.png"
          }
          className="h-10 w-10 rounded-full object-cover"
        />
      </div>
      <div className="pl-2 text-sm">
        <div className="flex items-center">
          <p>{props.username}</p>
          {props.isGroup && (
            <IconGroup className="ml-1 h-4 w-4 text-gray-400" />
          )}
          {!props.hasJoinPermission && (
            <IconBlock className="ml-1 h-3.5 w-3.5 text-gray-400" />
          )}
        </div>
        <p className="h-5 font-light">{props.description ?? ""}</p>
      </div>
    </div>
  );
}

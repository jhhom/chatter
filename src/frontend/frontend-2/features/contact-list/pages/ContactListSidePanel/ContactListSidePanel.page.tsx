import { ContactSearch } from "~/frontend/frontend-2/features/common/components";

import {
  IconSettings2,
  IconAddPerson,
} from "~/frontend/frontend-2/features/common/icons";
import { usePathname } from "next/navigation";
import { Tooltip, TooltipTrigger } from "@adobe/react-spectrum";
import { useRouter } from "next/navigation";

type ContactListProps = {
  name: string;
  text: string;
  picture: string;
  time: string;
  online: boolean;
};

const contactList: ContactListProps[] = [
  {
    name: "John Graham",
    text: "Mauris did not laugh in the book",
    picture: "./new-ui-assets/man-1-[white].jpg",
    time: "15:07",
    online: false,
  },
  {
    name: "Designer team",
    text: "I done for today. Good weekend everyone!",
    picture: "./new-ui-assets/abstract-art.jpg",
    time: "12:15",
    online: true,
  },
  {
    name: "Denis Jakubow",
    text: "The keyboard may be intact but not broken",
    picture: "./new-ui-assets/man-6-[white].jpg",
    time: "9:46",
    online: false,
  },
  {
    name: "Samantha Mathew",
    text: "The author of the street arc is easy to recognize",
    picture: "./new-ui-assets/girl-1.jpg",
    time: "8:59",
    online: true,
  },
];

export function SidePanelContactList() {
  return (
    <div>
      <Header />

      <div className="mt-6 px-5">
        <ContactSearch />
      </div>
      <div className="space-y-4 pt-4">
        {contactList.map((c) => (
          <Contact
            name={c.name}
            text={c.text}
            picture={c.picture}
            time={c.time}
            online={c.online}
          />
        ))}
      </div>
    </div>
  );
}

function Header() {
  const router = useRouter();

  return (
    <div className="px-5 pt-4">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xl font-semibold">Chats</p>
        </div>
        <div className="flex items-start space-x-2">
          <HeaderButton
            icon={<IconSettings2 className="w-5 text-gray-500" />}
            tooltip="Settings"
            onClick={() => {
              void router.push(`settings`);
            }}
          />
          <HeaderButton
            icon={<IconAddPerson className="w-5 text-gray-500" />}
            tooltip="Add contact"
            onClick={() => {
              void router.push(`newtpk`);
            }}
          />
        </div>
      </div>
      <p className="mt-3 text-[13px] text-gray-500">26 messages, 3 unread</p>
    </div>
  );
}

function HeaderButton(props: {
  icon: JSX.Element;
  tooltip: string;
  onClick: () => void;
}) {
  return (
    <TooltipTrigger>
      <button
        onClick={props.onClick}
        className="rounded-md p-1  text-gray-500 hover:bg-gray-200"
      >
        {props.icon}
      </button>
      <Tooltip>{props.tooltip}</Tooltip>
    </TooltipTrigger>
  );
}

function Contact(props: {
  name: string;
  text: string;
  picture: string;
  time: string;
  online: boolean;
}) {
  return (
    <div className="flex cursor-pointer items-center px-5 py-2 hover:bg-gray-100">
      <div className="relative w-10">
        <img
          className="inline-block h-10 w-10 rounded-lg object-cover"
          src={props.picture}
        />
        {props.online && (
          <div className="absolute -right-1 -top-1 h-3 w-3 rounded-sm bg-white p-[0.1rem]">
            <div className="h-full w-full rounded-sm bg-green-400/80" />
          </div>
        )}
      </div>

      <div className="flex h-10 w-[calc(100%-2.5rem)] flex-col justify-between pl-3.5">
        <div className="flex items-end justify-between">
          <p className="text-sm font-medium">{props.name}</p>
          <p className="text-xs font-medium text-gray-500">{props.time}</p>
        </div>

        <div>
          <p className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-gray-500">
            {props.text}
          </p>
        </div>
      </div>
    </div>
  );
}

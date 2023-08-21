import { ContactSearch } from "~/frontend/frontend-2/features/common/components";

import {
  IconSettings2,
  IconAddPerson,
} from "~/frontend/frontend-2/features/common/icons";
import { Tooltip, TooltipTrigger } from "@adobe/react-spectrum";
import { useRouter } from "next/navigation";
import { useAppStore } from "~/frontend/stores/stores";

import {
  type GroupTopicId,
  type UserId,
} from "~/api-contract/subscription/subscription";
import { type LastMessageOfTopic } from "~/backend/service/topics/common/get-user-topics/get-last-message-of-topic.repo";

import {
  ContactListContact,
  ContactListNewContact,
} from "~/frontend/frontend-2/features/contact-list/pages/ContactListSidePanel/Contact";

type TopicListItem = {
  name: string;
  description: string;
  profilePhotoUrl: string | null;
  touchedAt: Date | null;
} & (
  | {
      type: "grp";
      topicId: GroupTopicId;
      typing: {
        id: `usr${string}`;
        fullname: string;
      } | null;
      online: boolean;
      lastMessage: LastMessageOfTopic | null;
    }
  | {
      type: "p2p";
      topicId: UserId;
      typing: boolean;
      online: boolean;
      lastMessage: LastMessageOfTopic | null;
    }
  | {
      type: "past-grp";
      topicId: GroupTopicId;
      lastMessage: LastMessageOfTopic | null;
    }
  | {
      type: "new-p2p-contact";
      topicId: UserId;
    }
);

export function SidePanelContactList() {
  const router = useRouter();
  const store = useAppStore((s) => ({
    contacts: {
      newContacts: s.newContacts,
      p2p: s.p2p,
      grp: s.grp,
      pastGrp: s.pastGrp,
      set: s.setContact,
    },
    profile: s.profile,
  }));

  if (store.profile === undefined) {
    throw new Error("User profile is not defined");
  }

  const topicListItems: TopicListItem[] = [
    ...Array.from(store.contacts.grp.entries()).map(([id, p]) => {
      let typing = null;
      if (p.status.online) {
        typing = p.status.latestTyping;
      }
      return {
        type: "grp" as const,
        topicId: id,
        name: p.profile.name,
        description: p.profile.description,
        online: p.status.online,
        typing,
        profilePhotoUrl: p.profile.profilePhotoUrl,
        touchedAt: p.profile.touchedAt,
        lastMessage: p.profile.lastMessage,
      };
    }),
    ...Array.from(store.contacts.p2p.entries()).map(([id, p]) => {
      return {
        type: "p2p" as const,
        topicId: id,
        name: p.profile.name,
        description: p.profile.description,
        online: p.status.online,
        typing: p.status.online && p.status.typing,
        profilePhotoUrl: p.profile.profilePhotoUrl,
        touchedAt: p.profile.touchedAt,
        lastMessage: p.profile.lastMessage,
      };
    }),
    ...Array.from(store.contacts.pastGrp.entries()).map(([id, p]) => {
      return {
        type: "past-grp" as const,
        topicId: id,
        name: p.profile.name,
        description: p.profile.description,
        profilePhotoUrl: p.profile.profilePhotoUrl,
        touchedAt: p.profile.touchedAt,
        lastMessage: p.profile.lastMessage,
      };
    }),
    ...Array.from(store.contacts.newContacts.entries()).map(([id, p]) => {
      return {
        type: "new-p2p-contact" as const,
        topicId: id,
        name: p.name,
        description: p.description,
        profilePhotoUrl: p.profilePhotoUrl,
        touchedAt: p.touchedAt,
      };
    }),
  ].sort((a, b) => {
    if (a.touchedAt === null) {
      return 1;
    }
    if (b.touchedAt === null) {
      return -1;
    }
    return a.touchedAt > b.touchedAt ? -1 : 1;
  });

  return (
    <div>
      <Header />

      <div className="mt-6 px-5">
        <ContactSearch />
      </div>

      <div className="space-y-4 pt-4">
        {topicListItems.map((t) => {
          if (store.profile.profile === null) {
            throw new Error("User profile is not defined");
          }

          if (t.type == "p2p") {
            return (
              <ContactListContact
                key={t.topicId}
                type={t.type}
                userId={store.profile.profile?.userId}
                onClick={() => {
                  router.push(location.pathname + `?topic=${t.topicId}`);
                }}
                topicId={t.topicId}
                fullname={t.name}
                isTyping={t.typing}
                isOnline={t.online}
                profilePhotoUrl={t.profilePhotoUrl}
                lastMessage={
                  t.lastMessage === null || t.lastMessage === undefined
                    ? null
                    : t.lastMessage
                }
              />
            );
          } else if (t.type == "grp") {
            return (
              <ContactListContact
                key={t.topicId}
                type={t.type}
                userId={store.profile.profile.userId}
                onClick={() => {
                  router.push(location.pathname + `?topic=${t.topicId}`);
                }}
                topicId={t.topicId}
                fullname={t.name}
                typingUserFullname={t.typing?.fullname}
                isOnline={t.online}
                profilePhotoUrl={t.profilePhotoUrl}
                lastMessage={
                  t.lastMessage === null || t.lastMessage === undefined
                    ? null
                    : t.lastMessage
                }
              />
            );
          } else if (t.type == "past-grp") {
            return (
              <ContactListContact
                key={t.topicId}
                type={t.type}
                userId={store.profile.profile.userId}
                onClick={() => {
                  router.push(location.pathname + `?topic=${t.topicId}`);
                }}
                topicId={t.topicId}
                fullname={t.name}
                profilePhotoUrl={t.profilePhotoUrl}
                lastMessage={
                  t.lastMessage === null || t.lastMessage === undefined
                    ? null
                    : t.lastMessage
                }
              />
            );
          } else {
            return (
              <ContactListNewContact
                key={t.topicId}
                onClick={() => {
                  router.push(location.pathname + `?topic=${t.topicId}`);
                }}
                topicId={t.topicId}
                fullname={t.name}
                profilePhotoUrl={t.profilePhotoUrl}
              />
            );
          }
        })}
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
  picture: string | null;
  time: string;
  online: boolean;
}) {
  return (
    <div className="flex cursor-pointer items-center px-5 py-2 hover:bg-gray-100">
      <div className="relative w-10">
        <img
          className="inline-block h-10 w-10 rounded-lg object-cover"
          src={props.picture === null ? "" : props.picture}
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

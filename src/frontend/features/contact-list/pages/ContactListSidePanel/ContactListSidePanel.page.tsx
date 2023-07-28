import { useAppStore } from "~/frontend/stores/stores";
import { GroupTopicId, UserId } from "~/api-contract/subscription/subscription";
import { useRouter } from "next/navigation";

import { LastMessageOfTopic } from "~/backend/service/topics/common/get-user-topics/get-last-message-of-topic.repo";
import {
  AddContactBtn,
  ContactListContact,
  ContactListNewContact,
  SettingBtn,
} from "~/frontend/features/contact-list/pages/ContactListSidePanel/components";

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

export function ContactListSidePanel() {
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
    <div className="w-[22rem]">
      <div className="bg-blue-500 px-1.5 py-4 text-lg text-white">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center">
            <div className="h-10 w-10 rounded-full">
              <img
                className="h-10 w-10 rounded-full object-cover"
                src={
                  store.profile.profile?.profilePhotoUrl ??
                  "https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Google_Images_2015_logo.svg/2880px-Google_Images_2015_logo.svg.png"
                }
              />
            </div>
            <p className="ml-2">{store.profile.profile?.fullname}</p>
          </div>
          <div className="mr-2 flex">
            <div>
              <AddContactBtn
                onClick={() => {
                  router.push("newtpk");
                }}
              />
            </div>
            <div className="ml-2 mt-1">
              <SettingBtn
                onClick={() => {
                  router.push("settings");
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div>
        {topicListItems.map((t, i) => {
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

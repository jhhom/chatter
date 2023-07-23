import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ok } from "neverthrow";
import clsx from "clsx";
import { match } from "ts-pattern";

import ContactListTab from "~/frontend/features/contact-list/pages/FindContact/ContactListTab";
import NewGroupTab from "~/frontend/features/contact-list/pages/FindContact/NewGroupTab";
import { ByIdTab } from "~/frontend/features/contact-list/pages/FindContact/components";
import { BackBtn } from "~/frontend/features/common/components";

import { IsGroupTopicId, IsUserId } from "~/backend/service/common/topics";
import { file2Base64 } from "~/frontend/utils";

import { useAppStore } from "~/frontend/stores/stores";
import { client } from "~/frontend/external/api-client/client";

const Tabs = ["Find", "New Group", "By ID"] as const;

export default function FindContactPanel() {
  const router = useRouter();

  const [selectedTab, setSelectedTab] = useState<(typeof Tabs)[number]>("Find");
  const [searchQuery, setSearchQuery] = useState("");

  const store = useAppStore((s) => ({
    contact: {
      grp: s.grp,
      p2p: s.p2p,
      newContacts: s.newContacts,
      addNewContact: s.addNewContact,
      addCreatedGroupContact: s.addCreatedGroupContact,
    },
    profile: s.profile,
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

    return query.data?.filter((u) => {
      return (
        topics.find((t) => t === u.id) === undefined &&
        u.id !== store.profile?.userId
      );
    });
  })();

  return (
    <div>
      <div className="flex bg-blue-500 px-4 py-4 text-lg text-white">
        <BackBtn onClick={() => router.push("/")} />
        <p className="ml-4">Start New chat</p>
      </div>
      <div className="bg-gray-200 px-3">
        <div className="flex">
          {Tabs.map((t) => (
            <button
              key={t}
              onClick={() => setSelectedTab(t)}
              className={clsx("px-3 py-1.5", {
                "border-0 border-b-[2.5px] border-b-blue-400 bg-white":
                  selectedTab === t,
                "border border-b-[2.5px] border-gray-300 border-b-gray-300":
                  selectedTab !== t,
              })}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div>
        {match(selectedTab)
          .with("Find", () => (
            <ContactListTab
              onSearchEnter={(query) => {
                setSearchQuery(query);
              }}
              contactList={
                filteredUsers?.map((v) => ({
                  userId: v.id,
                  username: "",
                  email: v.email,
                  fullname: v.fullname,
                  userPermission: v.defaultPermissions,
                  profilePhotoUrl: v.profilePhotoUrl,
                })) || []
              }
              onContactClick={async (u) => {
                store.contact.addNewContact(u.userId, {
                  name: u.fullname,
                  description: u.username,
                  touchedAt: new Date(),
                  userPermissions: u.userPermission,
                  profilePhotoUrl: u.profilePhotoUrl,
                  lastMessage: null,
                });
              }}
            />
          ))
          .with("New Group", () => (
            <NewGroupTab
              onSubmit={async (v) => {
                let photoBase64: string | null = null;
                if (v.profileImage) {
                  photoBase64 = await file2Base64(v.profileImage);
                }
                const result = await client["group/create_group"]({
                  groupName: v.groupName,
                  photoBase64,
                });
                if (result.isErr()) {
                  alert("Error creating group, error: " + result.error);
                  return;
                }
                alert("Group created successfully");
                // 1. add the topic into cache
                if (store.profile) {
                  store.contact.addCreatedGroupContact(result.value.topicId, {
                    name: result.value.groupName,
                    description: "",
                    touchedAt: null,
                    userPermissions: "JRWP",
                    defaultPermissions: "JRWP",
                    profilePhotoUrl: result.value.profilePhotoUrl,
                    lastMessage: null,
                    ownerId: store.profile?.userId,
                  });
                }

                // 2. return to the contact list
                router.push(`/?topic=${result.value.topicId}`);
              }}
            />
          ))
          .with("By ID", () => (
            <ByIdTab
              onSubscribeClick={async (topicId) => {
                // check if user already has the topic
                if (topicId === store.profile?.userId) {
                  router.push("/");
                } else if (IsGroupTopicId(topicId)) {
                  const groupContact = store.contact.grp.get(topicId);
                  if (groupContact !== undefined) {
                    router.push(`/?topic=${topicId}`);
                    return;
                  }

                  const contactPreviewInfoResult = await client[
                    "topic/preview_info"
                  ]({
                    topicId,
                  });
                  if (
                    contactPreviewInfoResult.isErr() &&
                    contactPreviewInfoResult.error.details.type ==
                      "RESOURCE_NOT_FOUND"
                  ) {
                    alert(`Group with given id is not found`);
                    return;
                  }

                  const r = await client["group/join_group_via_id"]({
                    groupTopicId: topicId,
                  });
                  if (r.isErr()) {
                    if (r.error.details.type == "GROUP.NO_JOIN_PERMISSION") {
                      alert(
                        `The group currently doesn't allow any new joiners`
                      );
                      return;
                    }
                    alert(`An unexpected error had occured`);
                    return;
                  }

                  store.contact.grp.delete(topicId);

                  store.contact.grp.set(topicId, {
                    profile: {
                      name: r.value.topicName,
                      userPermissions: r.value.userPermissions,
                      defaultPermissions: r.value.defaultPermissions,
                      description: "",
                      touchedAt: null,
                      profilePhotoUrl: r.value.profilePhotoUrl,
                      ownerId: r.value.ownerId,
                      lastMessage: {
                        type: "message",
                        content: "You joined the group",
                        sequenceId: 0,
                      },
                    },
                    status: {
                      online: r.value.online,
                      typing: [],
                      latestTyping: null,
                    },
                  });

                  router.push(`/?topic=${topicId}`);
                } else if (IsUserId(topicId)) {
                  if (
                    store.contact.newContacts.has(topicId) ||
                    store.contact.p2p.has(topicId)
                  ) {
                    router.push(`/?topic=${topicId}`);
                    return ok({});
                  }

                  const contactPreviewInfoResult = await client[
                    "topic/preview_info"
                  ]({
                    topicId,
                  });
                  if (contactPreviewInfoResult.isErr()) {
                    if (
                      contactPreviewInfoResult.error.details.type ==
                      "RESOURCE_NOT_FOUND"
                    ) {
                      alert(`User with specified id is not found`);
                      return;
                    }
                    alert("An unexpected error had occured");
                    return;
                  }
                  if (
                    contactPreviewInfoResult.value.type ==
                    "user already has contact"
                  ) {
                    router.push(`/?topic=${topicId}`);
                  } else if (
                    contactPreviewInfoResult.value.type == "new p2p contact"
                  ) {
                    const peer = contactPreviewInfoResult.value;
                    store.contact.newContacts.set(topicId, {
                      name: peer.value.name,
                      profilePhotoUrl: peer.value.profilePhotoUrl,
                      userPermissions: peer.value.defaultPermissions,
                      touchedAt: null,
                      description: "",
                      lastMessage: null,
                    });
                    router.push(`/?topic=${topicId}`);
                  }
                } else {
                  alert("Topic id is invalid");
                }
              }}
            />
          ))
          .exhaustive()}
      </div>
    </div>
  );
}

import { useState } from "react";
import { match } from "ts-pattern";
import { IconBackArrow } from "~/frontend/frontend-2/features/common/icons";

import { TabFindContact } from "./components/TabFindContact";
import { TabNewGroup } from "./components/TabNewGroup";
import { TabByID } from "./components/TabByID";

import { clsx as cx } from "clsx";
import { useRouter } from "next/navigation";

import { ok } from "neverthrow";
import { IsGroupTopicId, IsUserId } from "~/backend/service/common/topics";

import { useAppStore } from "~/frontend/stores/stores";
import { client } from "~/frontend/external/api-client/client";
import type { ServiceInput } from "~/api-contract/types";
import { toast, Toaster } from "react-hot-toast";

import { file2Base64 } from "~/frontend/utils";

export function SidePanelAddContacts() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"find" | "new-group" | "by-id">(
    "find"
  );
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

  return (
    <div className="h-[calc(100vh-4rem)] bg-white pt-4">
      <div className="flex h-9">
        <div className="pl-4">
          <button
            onClick={() => router.push("/")}
            className="rounded-lg border border-gray-300 px-2 py-2 hover:bg-gray-100"
          >
            <IconBackArrow className="h-4 w-4 text-gray-600" />
          </button>
        </div>

        <p className="flex items-center pl-3 text-lg font-medium">
          Add contacts
        </p>
      </div>

      <div className="h-[4.4rem] bg-white px-4 pb-3 pt-4">
        <div className="flex space-x-1 rounded-md border border-gray-100 bg-gray-100/60 px-1.5 py-1.5">
          <TabButton
            onClick={() => setActiveTab("find")}
            active={activeTab === "find"}
            text="Find"
          />
          <TabButton
            onClick={() => setActiveTab("new-group")}
            active={activeTab === "new-group"}
            text="New Group"
          />
          <TabButton
            onClick={() => setActiveTab("by-id")}
            active={activeTab === "by-id"}
            text="By ID"
          />
        </div>
      </div>

      <div className="h-[calc(100%-(4.4rem+2.25rem))]">
        {match(activeTab)
          .with("new-group", () => (
            <TabNewGroup
              onSubmit={async (v) => {
                let photoBase64: string | null = null;
                if (v.profileImage.length > 0) {
                  photoBase64 = await file2Base64(v.profileImage[0]);
                }
                const result = await client["group/create_group"]({
                  groupName: v.groupName,
                  photoBase64,
                });
                if (result.isErr()) {
                  alert("Error creating group, error: " + result.error.message);
                  return;
                }
                alert("Group created successfully");
                // 1. add the topic into cache
                store.contact.set((s) => {
                  if (s.profile !== null) {
                    s.grp.set(result.value.topicId, {
                      profile: {
                        name: result.value.groupName,
                        description: "",
                        touchedAt: null,
                        userPermissions: "JRWP",
                        defaultPermissions: "JRWP",
                        profilePhotoUrl: result.value.profilePhotoUrl,
                        lastMessage: null,
                        ownerId: s.profile.userId,
                      },
                      status: {
                        online: false,
                      },
                    });
                  }
                });

                // 2. return to the contact list
                router.push(`/?topic=${result.value.topicId}`);
              }}
            />
          ))
          .with("find", () => {
            if (store.profile.profile === null) {
              throw new Error("User profile is null");
            }

            return (
              <div className="h-full">
                <TabFindContact
                  findUsersToAddAsContact={(
                    props: ServiceInput<"users/find_users_to_add_as_contact">
                  ) => client["users/find_users_to_add_as_contact"](props)}
                  existingContacts={Array.from(store.contact.p2p.keys()).concat(
                    Array.from(store.contact.newContacts.keys())
                  )}
                  userId={store.profile.profile.userId}
                  onAddContact={(c) => {
                    store.contact.set((s) => {
                      s.newContacts.set(c.id, {
                        name: c.fullname,
                        description: c.email,
                        touchedAt: new Date(),
                        userPermissions: c.defaultPermissions,
                        profilePhotoUrl: c.profilePhotoUrl,
                        lastMessage: null,
                      });
                    });
                    toast("Contact added");
                  }}
                />
              </div>
            );
          })
          .with("by-id", () => (
            <div>
              <TabByID
                onSubscribeClick={async (topicId) => {
                  // check if user already has the topic
                  const userProfile = store.get().profile?.profile;
                  if (userProfile === undefined) {
                    return;
                  }

                  if (userProfile !== null && topicId === userProfile.userId) {
                    router.push("/");
                  } else if (IsGroupTopicId(topicId)) {
                    const groupContact = store.get().grp.get(topicId);
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

                    store.contact.set((s) => {
                      s.grp.delete(topicId);

                      s.grp.set(topicId, {
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
                    });

                    router.push(`/?topic=${topicId}`);
                  } else if (IsUserId(topicId)) {
                    if (
                      store.get().newContacts.has(topicId) ||
                      store.get().p2p.has(topicId)
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
                      store.contact.set((s) => {
                        s.newContacts.set(topicId, {
                          name: peer.value.name,
                          profilePhotoUrl: peer.value.profilePhotoUrl,
                          userPermissions: peer.value.defaultPermissions,
                          touchedAt: null,
                          description: "",
                          lastMessage: null,
                        });
                      });
                      router.push(`/?topic=${topicId}`);
                    }
                  } else {
                    alert("Topic id is invalid");
                  }
                }}
              />
            </div>
          ))
          .exhaustive()}
      </div>
    </div>
  );
}

function TabButton(props: {
  text: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className={cx("rounded-md px-3 py-1 text-sm", {
        "bg-green-200/60 text-green-600": props.active,
      })}
      onClick={props.onClick}
    >
      {props.text}
    </button>
  );
}

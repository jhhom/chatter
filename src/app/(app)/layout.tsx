"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { useEffect, useLayoutEffect, useState } from "react";
import "~/styles/globals.css";

import { useLoginHandler } from "~/frontend/frontend-2/features/auth/hooks/use-login-handler.hook";

import { useAppStore } from "~/frontend/stores/stores";
import { dexie } from "~/frontend/external/browser/indexed-db";
import { client } from "~/frontend/external/api-client/client";
import { match } from "ts-pattern";
import LoginPage from "~/frontend/frontend-2/features/auth/pages/Login/Login.page";
import { enableMapSet } from "immer";

import { IconPerson } from "~/frontend/frontend-2/features/common/icons";
import ChatPage from "~/frontend/frontend-2/features/chat/pages/Chat.page";

import { defaultTheme, Provider } from "@adobe/react-spectrum";

import { DialogTrigger, Dialog, Modal } from "react-aria-components";
import { Toaster } from "react-hot-toast";
import { useSearchParams, useRouter } from "next/navigation";
import useAsyncEffect from "use-async-effect";
import { IsGroupTopicId, IsUserId } from "~/backend/service/common/topics";
import { type ServiceOutput } from "~/api-contract/types";

import { useLocalStorageAuthToken } from "~/frontend/external/browser/local-storage";

const queryClient = new QueryClient();

enableMapSet();

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // @ts-expect-error ignore error on matomo's code
    // eslint-disable-next-line
    const _mtm = (window._mtm = window._mtm || []);

    // eslint-disable-next-line
    _mtm.push({ "mtm.startTime": new Date().getTime(), event: "mtm.Start" });
    const d = document,
      g = d.createElement("script"),
      s = d.getElementsByTagName("script")[0];
    g.async = true;
    g.src = "https://matomo.joohom.dev/js/container_laAS7g6v.js";

    // @ts-expect-error ignore error on matomo's code
    s.parentNode.insertBefore(g, s);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <html lang="en">
        <body>
          <Provider theme={defaultTheme} colorScheme="light">
            <Layout>{children}</Layout>
          </Provider>
        </body>
      </html>
    </QueryClientProvider>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const store = useAppStore((s) => ({
    setContact: s.setContact,
    setAfterLoginNavigateTo: s.setAfterLoginNavigateTo,
    setAuthStatus: s.setAuthStatus,
    setProfile: s.setProfile,
    authStatus: s.authStatus,
    get: s.get,
  }));

  const [groupPreview, setGroupPreview] =
    useState<ServiceOutput<"group/preview_info"> | null>(null);

  const { onLoginSuccess } = useLoginHandler();
  const searchParams = useSearchParams();
  const router = useRouter();
  const joinGroupParam = searchParams.get("join_group");
  const topicParam = searchParams.get("topic");

  const tokenStorage = useLocalStorageAuthToken();

  // This hook setups socket connection and performs auto-login
  // If there is token in local storage
  useEffect(() => {
    void (async () => {
      // clears the previous cache data that could be outdated in IndexedDB
      // - cache data becomes outdated when client stops connecting to the server
      // - and hence doesn't receive any updates (e.g new messages, new events) from server
      // - this hook runs during the setup of the application, where no connection has yet been established to the server
      // - (this hook itself is the one responsible to establish that server connection)
      // - hence the cache data is already outdated
      await dexie.messages.clear();
      await dexie.topicEventLogs.clear();

      if (
        tokenStorage.token === null ||
        tokenStorage.token === "" ||
        tokenStorage.token === undefined
      ) {
        store.setAuthStatus("logged-out");
        tokenStorage.clearToken();
        router.push("/");
      } else {
        const r = await client["auth/login_with_token"]({
          jwtToken: tokenStorage.token,
        });
        if (r.isErr()) {
          tokenStorage.clearToken();
          store.setProfile(null);
          store.setAuthStatus("logged-out");
          return;
        }
        const loginHandlingResult = await onLoginSuccess({
          ...r.value,
          userId: r.value.id,
        });
        if (loginHandlingResult.isErr()) {
          tokenStorage.clearToken();
          store.setProfile(null);
          store.setAuthStatus("logged-out");
          return;
        }
        store.setProfile({ userId: r.value.id, ...r.value });
        store.setAuthStatus("logged-in");
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    if (
      (tokenStorage.token === null || tokenStorage.token === "") &&
      store.authStatus === "logged-in"
    ) {
      location.reload();
    } else if (
      tokenStorage.token !== null &&
      tokenStorage.token !== "" &&
      store.authStatus === "logged-out"
    ) {
      // reloads to run hook 1
      location.reload();
    }
  }, [tokenStorage.token, store.authStatus]);

  useEffect(() => {
    const removeParam = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete("topic");
      router.push(url.toString());
    };

    if (topicParam === null) {
      return;
    }
    if (topicParam === "") {
      removeParam();
      return;
    }

    const contacts = store.get();

    if (
      (IsUserId(topicParam) &&
        !contacts.p2p.has(topicParam) &&
        !contacts.newContacts.has(topicParam)) ||
      (IsGroupTopicId(topicParam) &&
        !contacts.grp.has(topicParam) &&
        !contacts.pastGrp.has(topicParam)) ||
      (!IsUserId(topicParam) && !IsGroupTopicId(topicParam))
    ) {
      removeParam();
    }
  });

  useAsyncEffect(async () => {
    if (joinGroupParam === null) {
      return;
    }

    const removeParam = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete("join_group");
      router.push(url.toString());
    };

    if (joinGroupParam === "") {
      removeParam();
      return;
    }

    if (store.authStatus === "logged-in") {
      const r = await client["group/preview_info"]({
        groupInviteLinkId: joinGroupParam,
      });
      if (r.isErr()) {
        removeParam();
        return;
      }
      const isUserAMember = await client["group/am_i_group_member_of"]({
        groupTopicId: r.value.groupId,
      });
      if (isUserAMember.isErr()) {
        removeParam();
        return;
      }
      if (isUserAMember.value) {
        const url = new URL(window.location.href);
        url.searchParams.delete("join_group");
        url.searchParams.set("topic", r.value.groupId);
        router.push(url.toString());
      } else {
        setGroupPreview(r.value);
      }
    } else {
      store.setAfterLoginNavigateTo(`?join_group=${joinGroupParam}`);
      router.push("/");
    }
    // check if user is authenticated
    // if yes:
    //  check if group is valid, if group is valid, does user belongs to the group,
    // if no:
    //  redirect to login, and set to navigate to after login successful
  }, [joinGroupParam, router, store.authStatus]);

  return match(store.authStatus)
    .with("loading", () => {
      return (
        <div className="flex h-screen w-screen items-center justify-center">
          <p>Loading application...</p>
        </div>
      );
    })
    .with("logged-in", () => {
      return (
        <div className="relative flex h-screen w-screen">
          <div className="h-full w-[22rem] border-r">
            <Header />
            <div className="h-[calc(100%-4rem)]">{children}</div>
          </div>
          <div className=" w-[calc(100vw-22rem)]">
            <ChatPage />
          </div>
          <Toaster position="top-right" />

          <DialogTrigger isOpen={groupPreview !== null}>
            <Modal className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md border border-gray-300 bg-white shadow-md">
              <Dialog className="px-5 py-5">
                {({ close }) => (
                  <div>
                    <div className="flex">
                      <div className="h-16 w-16">
                        {groupPreview?.profilePhotoUrl ? (
                          <img src={groupPreview.profilePhotoUrl} />
                        ) : (
                          <div className="flex h-full w-full items-end justify-center rounded-lg bg-gray-100 pb-1">
                            <IconPerson className="h-12 w-12 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-[220px] pl-4 pt-2">
                        <p>{groupPreview?.groupName ?? ""}</p>
                        <p className="mt-3 text-sm">
                          {groupPreview?.numberOfParticipants ?? 0} participants
                        </p>
                      </div>
                    </div>

                    {!groupPreview?.canNewInviteJoin && (
                      <p>
                        The group currently doesn't allow joining the group
                        through invite link.
                      </p>
                    )}

                    <div className="mt-12 flex justify-end text-sm uppercase">
                      <button
                        onClick={() => {
                          const url = new URL(window.location.href);
                          url.searchParams.delete("join_group");
                          router.push(url.toString());
                          setGroupPreview(null);
                          close();
                        }}
                        className="rounded-md px-3 py-2 font-semibold text-green-600 hover:bg-gray-100"
                      >
                        CANCEL
                      </button>
                      {groupPreview?.canNewInviteJoin && (
                        <button
                          onClick={async () => {
                            if (joinGroupParam === null) {
                              const url = new URL(window.location.href);
                              url.searchParams.delete("join_group");
                              router.push(url.toString());
                              setGroupPreview(null);
                              close();
                              return;
                            }
                            const r = await client[
                              "group/join_group_via_invite_link"
                            ]({
                              inviteLinkId: joinGroupParam,
                            });
                            if (r.isErr()) {
                              if (
                                r.error.details.type ==
                                "GROUP.NO_JOIN_PERMISSION"
                              ) {
                                alert(
                                  "The group doesn't allow any new joiners"
                                );
                              } else {
                                alert(
                                  "Failed to join group, an unexpected error had occured"
                                );
                              }
                              const url = new URL(window.location.href);
                              url.searchParams.delete("join_group");
                              router.push(url.toString());
                              setGroupPreview(null);
                              return;
                            }

                            store.setContact((s) => {
                              s.pastGrp.delete(r.value.topicId);

                              s.grp.set(r.value.topicId, {
                                profile: {
                                  ownerId: r.value.ownerId,
                                  name: r.value.topicName,
                                  userPermissions: r.value.userPermissions,
                                  defaultPermissions:
                                    r.value.defaultPermissions,
                                  description: "",
                                  touchedAt: null,
                                  profilePhotoUrl: r.value.profilePhotoUrl,
                                  lastMessage: null,
                                },
                                status: {
                                  online: r.value.online,
                                  typing: [],
                                  latestTyping: null,
                                },
                              });
                            });

                            const url = new URL(window.location.href);
                            url.searchParams.delete("join_group");
                            url.searchParams.set("topic", r.value.topicId);
                            router.push(url.toString());
                            setGroupPreview(null);
                          }}
                          className="rounded-md px-3 py-2 font-semibold text-green-600 hover:bg-gray-100"
                        >
                          JOIN GROUP
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </Dialog>
            </Modal>
          </DialogTrigger>

          {/* TODO: show the group preview here */}
        </div>
      );
    })
    .with("logged-out", () => {
      return <LoginPage />;
    })
    .exhaustive();
}

export function Header() {
  const profile = useAppStore((s) => s.profile.profile);

  return (
    <div className="flex h-16 w-full items-center">
      <div className="flex h-full w-full border-b-[1.5px] border-gray-200 px-5">
        <div className="mr-2 self-center">
          {profile?.profilePhotoUrl ? (
            <img
              className="inline-block h-10 w-10 rounded-lg object-cover"
              src={profile?.profilePhotoUrl ?? ""}
            />
          ) : (
            <div className="flex h-10 w-10 items-end justify-center rounded-lg bg-gray-100 pb-1">
              <IconPerson className="h-7 w-7 text-gray-400" />
            </div>
          )}
        </div>
        <div className="flex flex-col justify-end self-center">
          <p className="text-sm font-medium">{profile?.fullname}</p>
          <p className="text-[13px] text-gray-500">@{profile?.username}</p>
        </div>
      </div>
    </div>
  );
}

"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { useEffect } from "react";
import "~/styles/globals.css";

import { useLoginHandler } from "~/frontend/frontend-2/features/auth/hooks/use-login-handler.hook";

import { useAppStore } from "~/frontend/stores/stores";
import { dexie } from "~/frontend/external/browser/indexed-db";
import storage from "~/frontend/external/browser/local-storage";
import { client } from "~/frontend/external/api-client/client";
import { match } from "ts-pattern";
import LoginPage from "~/frontend/frontend-2/features/auth/pages/Login/Login.page";
import { enableMapSet } from "immer";

import { IconPerson } from "~/frontend/frontend-2/features/common/icons";
import ChatPage from "~/frontend/frontend-2/features/chat/pages/Chat.page";

const queryClient = new QueryClient();

enableMapSet();

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <html lang="en">
        <body>
          <>
            <Layout>{children}</Layout>
          </>
        </body>
      </html>
    </QueryClientProvider>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const store = useAppStore((s) => ({
    setAuthStatus: s.setAuthStatus,
    setProfile: s.setProfile,
    authStatus: s.authStatus,
  }));

  const { onLoginSuccess } = useLoginHandler();

  useEffect(() => {
    void (async () => {
      await dexie.messages.clear();
      await dexie.topicEventLogs.clear();

      const token = storage.token();

      if (token === null || token === "") {
        store.setAuthStatus("logged-out");
        storage.clearToken();
      } else {
        const r = await client["auth/login_with_token"]({ jwtToken: token });
        if (r.isErr()) {
          storage.clearToken();
          store.setProfile(null);
          store.setAuthStatus("logged-out");
          return;
        }
        const loginHandlingResult = await onLoginSuccess({
          ...r.value,
          userId: r.value.id,
        });
        if (loginHandlingResult.isErr()) {
          storage.clearToken();
          store.setProfile(null);
          store.setAuthStatus("logged-out");
          return;
        }
        store.setProfile({ userId: r.value.id, ...r.value });
        store.setAuthStatus("logged-in");
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
        <div className="flex h-screen w-screen">
          <div className="w-[22rem]">
            <Header />
            <div>{children}</div>
          </div>
          <div className=" w-[calc(100vw-22rem)]">
            <ChatPage />
          </div>
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

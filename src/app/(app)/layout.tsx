"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect } from "react";
import "~/styles/globals.css";

import { IsGroupTopicId, IsUserId } from "~/backend/service/common/topics";
import { useLoginHandler } from "~/frontend/features/auth/hooks/use-login-handler.hook";

import { useAppStore } from "~/frontend/stores/stores";
import { dexie } from "~/frontend/external/browser/indexed-db";
import storage from "~/frontend/external/browser/local-storage";
import { client } from "~/frontend/external/api-client/client";
import { match } from "ts-pattern";
import LoginPage from "~/frontend/features/auth/pages/Login/Login.page";

const queryClient = new QueryClient();

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <html lang="en">
        <body>
          <Layout>{children}</Layout>
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
    (async () => {
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
          store.setProfile(undefined);
          store.setAuthStatus("logged-out");
          return;
        }
        const loginHandlingResult = await onLoginSuccess(r.value);
        if (loginHandlingResult.isErr()) {
          storage.clearToken();
          store.setProfile(undefined);
          store.setAuthStatus("logged-out");
          return;
        }
        store.setProfile({ userId: r.value.id, ...r.value });
        store.setAuthStatus("logged-in");
      }
    })();
  }, []);

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
          <div className="w-[22rem]">{children}</div>
          <div className="w-[calc(100vw-22rem)]">
            <div>Chat page</div>
          </div>
        </div>
      );
    })
    .with("logged-out", () => {
      return <LoginPage />;
    })
    .exhaustive();
}

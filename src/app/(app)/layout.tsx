"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { useEffect } from "react";
import "~/styles/globals.css";

import { useLoginHandler } from "~/frontend/features/auth/hooks/use-login-handler.hook";

import { useAppStore } from "~/frontend/stores/stores";
import { dexie } from "~/frontend/external/browser/indexed-db";
import storage from "~/frontend/external/browser/local-storage";
import { client } from "~/frontend/external/api-client/client";
import { match } from "ts-pattern";
import LoginPage from "~/frontend/features/auth/pages/Login/Login.page";
import ChatPage from "~/frontend/features/chat/pages/Chat.page";
import { enableMapSet } from "immer";
import { ChatTextInput } from "~/frontend/features/chat/pages/components/ChatTextInput/ChatTextInput";

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

function Layout2({ children }: { children: React.ReactNode }) {
  const store = useAppStore((s) => ({
    p2p: s.p2p,
    setContact: s.setContact,
    get: s.get,
  }));

  useEffect(() => {
    store.setContact((s) => {
      s.pastGrp = new Map();
      s.pastGrp.set("grp123", {
        profile: {
          name: "PAST GRp",
          description: "ex grp",
          touchedAt: null,
          profilePhotoUrl: null,
          lastMessage: null,
        },
      });
    });

    console.log(store.get().pastGrp);
  }, []);

  return (
    <div>
      <p>Layout2</p>
    </div>
  );
}

function Layout3() {
  return (
    <ChatTextInput
      inputMode={{ type: "message" }}
      onLoadFile={() => {
        //
      }}
      onLoadPhoto={() => {
        //
      }}
      disabled={false}
      onTyping={(t) => console.log("typing", t)}
      onMessageSubmit={(s) => {
        console.log(s);
      }}
    />
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
          <div className="w-[22rem]">{children}</div>
          <div className="w-[calc(100vw-22rem)]">
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

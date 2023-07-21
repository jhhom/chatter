"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect } from "react";
import {
  ClientProvider,
  useClientContext,
} from "~/components/hooks/stores/client";
import { useLayoutToShowStore } from "~/components/hooks/stores/layout-to-show";
import storage from "~/components/hooks/stores/local-storage";
import "~/styles/globals.css";

import { DummyView } from "~/components/chat/presentations/chat/ChatPage/ChatPage";
import { ChatPage } from "~/components/chat/containers/ChatPage";

import { useHandleLoginSuccess } from "~/components/hooks/actions/handle-login-success.hook";
import { IsGroupTopicId, IsUserId } from "~/backend/service/common/topics";

const queryClient = new QueryClient();

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const layout = useLayoutToShowStore((s) => s.layout);

  return (
    <QueryClientProvider client={queryClient}>
      <ClientProvider>
        <html lang="en">
          <body>
            <Layout children={children} />
          </body>
        </html>
      </ClientProvider>
    </QueryClientProvider>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const layout = useLayoutToShowStore();
  const client = useClientContext();
  const router = useRouter();

  const handleLoginSuccess = useHandleLoginSuccess();

  const isAuthed = client.isAuthed();

  useEffect(() => {
    if (layout.layout !== "login" && !isAuthed) {
      layout.setLayout("login");
    }
  }, [layout.layout, isAuthed]);

  useEffect(() => {
    const token = storage.token();

    if (token === null) {
      return;
    }

    client["auth/login_with_token"]({ jwtToken: token }).then((v) => {
      if (v.isErr()) {
        storage.clearToken();
        layout.setLayout("login");
        router.push("/");
        return;
      }

      handleLoginSuccess();
    });
  }, []);

  if (layout.layout === "login") {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen">
      <div className="w-[22rem]">{children}</div>
      <div className="w-[calc(100vw-22rem)]">
        <ChatConversation />
      </div>
    </div>
  );
}

function ChatConversation() {
  const searchParams = useSearchParams();
  const topicParam = searchParams.get("topic");

  if (
    topicParam === null ||
    !(IsGroupTopicId(topicParam) || IsUserId(topicParam))
  ) {
    return (
      <div className="h-full w-full">
        <DummyView />
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ChatPage topicId={topicParam} />
    </div>
  );
}

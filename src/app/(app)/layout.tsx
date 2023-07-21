"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect } from "react";
import "~/styles/globals.css";

import { IsGroupTopicId, IsUserId } from "~/backend/service/common/topics";

const queryClient = new QueryClient();

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Layout children={children} />
      </body>
    </html>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <div className="w-[22rem]">{children}</div>
      <div className="w-[calc(100vw-22rem)]"></div>
    </div>
  );
}

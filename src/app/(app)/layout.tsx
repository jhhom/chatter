"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "~/styles/globals.css";

import { enableMapSet } from "immer";

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
            <div>{children}</div>
          </>
        </body>
      </html>
    </QueryClientProvider>
  );
}

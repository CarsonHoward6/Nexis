"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "./Toast";
import { IntroScreen } from "./IntroScreen";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 2_000,
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <ToastProvider>
          <IntroScreen>{children}</IntroScreen>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

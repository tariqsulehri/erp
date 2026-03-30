'use client';

/**
 * ============================================================================
 * Client-Side Providers (providers.tsx)
 * ============================================================================
 *
 * Wraps the app with all context providers that require 'use client':
 * - SessionProvider: NextAuth session context
 * - QueryClientProvider: TanStack Query cache
 * - trpc.Provider: tRPC React transport linked to QueryClient
 *
 * Placed at the root layout so every page has access to session and API hooks.
 * ============================================================================
 */

import { useState } from 'react';
import type { ReactNode } from 'react';
import { SessionProvider } from 'next-auth/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import { trpc } from '@/lib/trpc/client';
import { ThemeProvider } from '@/lib/theme/theme-provider';

/**
 * Determine the absolute URL for the tRPC endpoint.
 * - Browser: relative path works fine → uses window.location.origin
 * - SSR / Node: must be absolute → read NEXTAUTH_URL or default to localhost
 */
function getBaseUrl() {
  if (typeof window !== 'undefined') return '';
  return process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
}

/** Client-side providers wrapper — keeps Server Components free of React context */
export function Providers({ children }: { children: ReactNode }) {
  /**
   * useState ensures a single QueryClient per browser tab.
   * Avoids a new client being created on every render.
   */
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            /** Keeps data fresh for 60 s before a background refetch */
            staleTime: 60 * 1000,
            /** Show cached data while refetching in the background */
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  /**
   * tRPC client — one per tab, created alongside the QueryClient.
   * httpBatchLink batches multiple tRPC calls into a single HTTP request.
   * superjson transformer handles Date, BigInt, Map, Set, etc.
   */
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
        }),
      ],
    }),
  );

  return (
    <ThemeProvider>
      <SessionProvider>
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        </trpc.Provider>
      </SessionProvider>
    </ThemeProvider>
  );
}

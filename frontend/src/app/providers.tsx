'use client';

/**
 * ============================================================================
 * Client-Side Providers (providers.tsx)
 * ============================================================================
 *
 * Wraps the app with all context providers that require 'use client':
 * - SessionProvider: NextAuth session context
 * - QueryClientProvider: TanStack Query cache
 *
 * Placed at the root layout so every page has access to session and API hooks.
 * ============================================================================
 */

import { useState } from 'react';
import type { ReactNode } from 'react';
import { SessionProvider } from 'next-auth/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/lib/theme/theme-provider';

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

  return (
    <ThemeProvider>
      <SessionProvider>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}

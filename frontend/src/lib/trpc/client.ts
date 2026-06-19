/**
 * ============================================================================
 * tRPC React Client (client.ts)
 * ============================================================================
 *
 * Creates the typed tRPC React hooks that components use to call the API.
 *
 * Usage in components:
 *   import { trpc } from '@/lib/trpc/client';
 *   const { data } = trpc.accounts.list.useQuery({ page: 1, limit: 20 });
 *   const mutation = trpc.accounts.create.useMutation();
 *
 * This file only exports the hooks — the actual HTTP transport and
 * QueryClient are configured in providers.tsx.
 * ============================================================================
 */

import { createTRPCReact } from '@trpc/react-query';
import type { CreateTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@/server/routers/_app';

/** Typed tRPC React hooks — import this in every component that calls the API */
export const trpc: CreateTRPCReact<AppRouter, unknown> = createTRPCReact<AppRouter>();

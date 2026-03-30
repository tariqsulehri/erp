import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/server/routers/_app';
import { createContext } from '@/server/context';

/**
 * tRPC HTTP endpoint
 * This is the entry point for all tRPC API calls
 */
const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext,
    onError: ({ path, error }) => {
      console.error(`Error in tRPC call on path "${path}":`, error);
    },
  });

export { handler as GET, handler as POST };

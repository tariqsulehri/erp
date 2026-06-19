import { getToken } from 'next-auth/jwt';
import { AppDataSource } from '@/db/data-source';

/**
 * User context carried on every tRPC request.
 * Populated from the NextAuth JWT cookie.
 */
export interface UserContext {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'accountant' | 'manager' | 'viewer';
  companies: string[];       // All company IDs the user can access
  currentCompanyId: string;  // Currently selected company
}

/**
 * Full context available to all tRPC procedures.
 * Injected by createContext() and passed to every router handler.
 */
export interface Context {
  user: UserContext | null;
  company_id: string;
  db: typeof AppDataSource;
  redis: any;
  requestId: string;
  timestamp: Date;
}

/**
 * Build the per-request tRPC context.
 *
 * Flow:
 * 1. Extract the NextAuth JWT from the incoming cookie header.
 * 2. Map token fields to UserContext.
 * 3. Ensure the TypeORM DataSource is initialised (lazy init).
 * 4. Return the full Context object.
 *
 * Called once per HTTP request by the tRPC fetchRequestHandler.
 *
 * @param opts.req  - The incoming Web Request (App Router fetch handler).
 * @param opts.redis - Optional Redis client instance.
 */
export async function createContext(opts?: {
  req?: Request;
  redis?: any;
}): Promise<Context> {
  let user: UserContext | null = null;

  /* ── 1. Extract NextAuth JWT from cookie ─────────────────────────────── */
  if (opts?.req) {
    try {
      /**
       * getToken reads the __Secure-next-auth.session-token (HTTPS) or
       * next-auth.session-token (HTTP) cookie and verifies the JWT signature.
       * Cast to `any` because getToken expects the Pages-Router IncomingMessage
       * type, but works fine with the Web Request in App Router via duck-typing.
       */
      const token = await getToken({
        req: opts.req as any,
        secret: process.env.NEXTAUTH_SECRET ?? '',
      });

      if (token) {
        user = {
          id: token.id as string,
          email: token.email as string,
          name: (token.name as string) ?? '',
          role: token.role as UserContext['role'],
          companies: (token.companies as string[]) ?? [],
          currentCompanyId: token.currentCompanyId as string,
        };
      }
    } catch {
      // Malformed or expired token — proceed as unauthenticated
    }
  }

  /* ── 2. Resolve active company ─────────────────────────────────────── */
  const companyId =
    user?.currentCompanyId ??
    process.env.DEFAULT_COMPANY_ID ??
    '';

  /* ── 3. Lazy-initialise TypeORM DataSource ──────────────────────────── */
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  /* ── 4. Return context ──────────────────────────────────────────────── */
  return {
    user,
    company_id: companyId,
    db: AppDataSource,
    redis: opts?.redis ?? null,
    requestId:
      opts?.req?.headers?.get('x-request-id') ??
      (crypto.randomUUID ? crypto.randomUUID() : ''),
    timestamp: new Date(),
  };
}

import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { backendInternalUrl } from './backend-internal-url';
import type { AccessLevel, SessionBranch, SessionWarehouse, UserRole } from './session-user';

/**
 * Sign-in is checked by the backend (POST /auth/login). The backend token is kept only inside the
 * encrypted NextAuth cookie and is attached to API calls by the /api/v1 proxy route on the server,
 * so browser JavaScript never sees it.
 */

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: UserRole;
      accessLevel: AccessLevel;
      branch: SessionBranch | null;
      warehouse: SessionWarehouse | null;
      companies: string[];
      currentCompanyId: string;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    accessLevel: AccessLevel;
    branch: SessionBranch | null;
    warehouse: SessionWarehouse | null;
    companies: string[];
    currentCompanyId: string;
    backendToken: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    accessLevel: AccessLevel;
    branch: SessionBranch | null;
    warehouse: SessionWarehouse | null;
    companies: string[];
    currentCompanyId: string;
    backendToken: string;
  }
}

interface BackendLoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    full_name: string;
    role: UserRole;
    access: Array<{
      company_id: string;
      access_level: AccessLevel;
      branch: SessionBranch | null;
      warehouse: SessionWarehouse | null;
    }>;
  };
}

// Matches the backend JWT_EXPIRES_IN default (12h), so the app session never outlives the backend token.
const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

/** Session encryption secret. Read when a request needs it, so builds work without it but servers never run without it. */
export function nextAuthSecret() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('NEXTAUTH_SECRET must be set to a private value of at least 32 characters.');
  }
  return secret;
}

function forwardedClientIp(headers: Record<string, string | string[] | undefined> | undefined) {
  const forwarded = headers?.['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
  return first || undefined;
}

async function signInWithBackend(email: string, password: string, clientIp?: string) {
  let response: Response;
  try {
    response = await fetch(`${backendInternalUrl()}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        // Lets the backend limit failed sign-ins per browser IP instead of per frontend server.
        ...(clientIp ? { 'x-forwarded-for': clientIp } : {}),
      },
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
    });
  } catch {
    throw new Error('The server is not available. Please try again in a moment.');
  }

  const body = await response.json().catch(() => null) as (BackendLoginResponse & { error?: { message?: string } }) | null;
  // Wrong email or password returns null, which NextAuth reports as CredentialsSignin.
  if (response.status === 401) return null;
  if (!response.ok || !body?.token) {
    throw new Error(body?.error?.message || 'Sign in failed. Please try again.');
  }
  return body;
}

export const authOptions: NextAuthOptions = {
  get secret() {
    return nextAuthSecret();
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null;

        const result = await signInWithBackend(credentials.email, credentials.password, forwardedClientIp(request?.headers));
        if (!result) return null;

        const defaultCompanyId = process.env.NEXT_PUBLIC_DEFAULT_COMPANY_ID;
        const access = result.user.access.find(row => row.company_id === defaultCompanyId) ?? result.user.access[0];

        return {
          id: result.user.id,
          email: result.user.email,
          name: result.user.full_name,
          role: result.user.role,
          accessLevel: access?.access_level ?? 'ALL_BRANCHES',
          branch: access?.branch ?? null,
          warehouse: access?.warehouse ?? null,
          companies: result.user.access.map(row => row.company_id),
          currentCompanyId: access?.company_id ?? defaultCompanyId ?? '',
          backendToken: result.token,
        };
      },
    }),
  ],

  pages: {
    signIn: '/login',
    error: '/login',
  },

  session: {
    strategy: 'jwt',
    maxAge: SESSION_MAX_AGE_SECONDS,
  },

  jwt: {
    maxAge: SESSION_MAX_AGE_SECONDS,
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.role = user.role;
        token.accessLevel = user.accessLevel;
        token.branch = user.branch;
        token.warehouse = user.warehouse;
        token.companies = user.companies;
        token.currentCompanyId = user.currentCompanyId;
        token.backendToken = user.backendToken;
      }
      return token;
    },

    // The backend token is deliberately left out of the session the browser can read.
    async session({ session, token }) {
      session.user = {
        id: token.id,
        email: token.email,
        name: token.name,
        role: token.role,
        accessLevel: token.accessLevel,
        branch: token.branch,
        warehouse: token.warehouse,
        companies: token.companies,
        currentCompanyId: token.currentCompanyId,
      };
      return session;
    },

    async redirect({ url, baseUrl }) {
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
};

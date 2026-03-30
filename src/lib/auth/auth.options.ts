import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { JWT } from 'next-auth/jwt';

/**
 * NextAuth v5 (Auth.js) Configuration
 * Using email/password authentication for development
 * Easily extensible to OAuth providers (Google, Microsoft, GitHub, etc.)
 */

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: 'admin' | 'accountant' | 'manager' | 'viewer';
      companies: string[];
      currentCompanyId: string;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'accountant' | 'manager' | 'viewer';
    companies: string[];
    currentCompanyId: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'accountant' | 'manager' | 'viewer';
    companies: string[];
    currentCompanyId: string;
  }
}

/**
 * Mock database of users (for development)
 * In production, query against your actual user table
 */
const mockUsers = [
  {
    id: '00000000-0000-0000-0000-000000000011',
    email: 'admin@example.com',
    name: 'Admin User',
    password: 'admin123', // NEVER hardcode in production
    role: 'admin' as const,
    companies: ['00000000-0000-0000-0000-000000000001'],
    currentCompanyId: '00000000-0000-0000-0000-000000000001',
  },
  {
    id: '00000000-0000-0000-0000-000000000012',
    email: 'accountant@example.com',
    name: 'Accountant User',
    password: 'accountant123',
    role: 'accountant' as const,
    companies: ['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'],
    currentCompanyId: '00000000-0000-0000-0000-000000000001',
  },
];

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'admin@example.com' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // In production, query your database
        // const user = await getUserFromDatabase(credentials.email);
        // const isPasswordValid = await bcrypt.compare(credentials.password, user.hashedPassword);

        // Mock authentication (for development only)
        const user = mockUsers.find(
          u => u.email === credentials.email && u.password === credentials.password,
        );

        if (!user) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          companies: user.companies,
          currentCompanyId: user.currentCompanyId,
        };
      },
    }),

    // Uncomment to add OAuth providers
    // GoogleProvider({
    //   clientId: process.env.GOOGLE_CLIENT_ID!,
    //   clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    // }),
    // MicrosoftProvider({
    //   clientId: process.env.MICROSOFT_CLIENT_ID!,
    //   clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
    // }),
  ],

  pages: {
    signIn: '/login',
    error: '/login',
  },

  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
    updateAge: 60 * 60, // Update session every hour
  },

  jwt: {
    secret: process.env.NEXTAUTH_SECRET,
    maxAge: 24 * 60 * 60, // 24 hours
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.role = user.role;
        token.companies = user.companies;
        token.currentCompanyId = user.currentCompanyId;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.email = token.email;
        session.user.name = token.name;
        session.user.role = token.role;
        session.user.companies = token.companies;
        session.user.currentCompanyId = token.currentCompanyId;
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      // Redirect to dashboard after login
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },

  events: {
    async signIn({ user }) {
      console.log(`User signed in: ${user?.email}`);
    },
    async signOut() {
      console.log('User signed out');
    },
  },

  debug: process.env.NODE_ENV === 'development',
};

import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: {
    signIn: '/login',
  },
});

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - /login
     * - /api/auth (NextAuth authentication endpoints)
     * - /api/v1 (backend proxy; it answers 401 itself instead of redirecting)
     * - /api/health (container health check)
     * - /_next/static (static files)
     * - /_next/image (image optimization files)
     * - favicon.ico, icon.svg, public assets
     */
    '/((?!api/auth|api/v1|api/health|_next/static|_next/image|favicon.ico|icon.svg|login).*)',
  ],
};

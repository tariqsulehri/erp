import { getToken } from 'next-auth/jwt';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { nextAuthSecret } from '@/lib/auth/auth.options';
import { backendInternalUrl } from '@/lib/auth/backend-internal-url';

// Forwards browser API calls to the backend and adds the signed-in user's backend token,
// which lives only in the encrypted session cookie. Replaces the old /api/v1 rewrite.

export const dynamic = 'force-dynamic';

const FORWARDED_REQUEST_HEADERS = ['accept', 'content-type', 'x-company-id', 'x-request-id'];
const FORWARDED_RESPONSE_HEADERS = ['content-type', 'content-disposition', 'cache-control'];

async function forward(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const token = await getToken({ req: request, secret: nextAuthSecret() });
  if (!token?.backendToken) {
    return NextResponse.json({ error: { code: 'REQUEST_ERROR', message: 'Please sign in to continue.' } }, { status: 401 });
  }

  const { path } = await params;
  if (path.some(segment => segment === '.' || segment === '..')) {
    return NextResponse.json({ error: { code: 'REQUEST_ERROR', message: 'Invalid request path.' } }, { status: 400 });
  }
  const target = `${backendInternalUrl()}/${path.map(encodeURIComponent).join('/')}${request.nextUrl.search}`;

  const headers = new Headers({ Authorization: `Bearer ${token.backendToken}` });
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  // No company chosen in the browser: use the company the user signed in to. The backend checks access either way.
  if (!headers.has('x-company-id') && typeof token.currentCompanyId === 'string' && token.currentCompanyId) {
    headers.set('x-company-id', token.currentCompanyId);
  }
  // The browser's IP, so the backend can log it and limit abuse per user rather than per frontend server.
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip');
  if (clientIp) headers.set('x-forwarded-for', clientIp);

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  let response: Response;
  try {
    response = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ error: { code: 'REQUEST_ERROR', message: 'The server is not available. Please try again in a moment.' } }, { status: 502 });
  }

  const responseHeaders = new Headers();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = response.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  return new NextResponse(response.body, { status: response.status, headers: responseHeaders });
}

export { forward as GET, forward as POST, forward as PUT, forward as PATCH, forward as DELETE };

import { NextResponse } from 'next/server';

// Liveness check for Docker and the reverse proxy. Public on purpose; it reveals nothing.
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({ status: 'ok', service: 'erp-frontend', timestamp: new Date().toISOString() });
}

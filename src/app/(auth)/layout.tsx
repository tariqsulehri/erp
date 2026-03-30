import type { ReactNode } from 'react';

/** Auth layout — full-page, no wrapper needed (login handles its own layout) */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

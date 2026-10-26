import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'ERP Financial Module',
  description: 'Professional-grade, multi-company ERP Financial Management System',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

// Applies the saved theme before the first paint so dark-theme users do not see a light flash.
const themeScript = `try{var t=localStorage.getItem('erp-theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

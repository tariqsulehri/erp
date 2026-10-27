import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '@/lib/fonts';
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

// Applies the saved theme classes ("erp", "dark", "vivid") before the first paint, so there is no light flash.
const themeScript = `try{var c=document.documentElement.classList;if(localStorage.getItem('erp-theme')==='dark')c.add('dark');if(localStorage.getItem('erp-vivid')==='1')c.add('vivid')}catch(e){}`;

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className="erp" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

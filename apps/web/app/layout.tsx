import type { Metadata } from 'next';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import Script from 'next/script';
import { Suspense } from 'react';
import { AppProviders } from '@/components/providers/app-providers';
import { THEME_FOUC_SCRIPT } from '@/lib/theme/css-variables';
import './globals.css';

const geistSans = GeistSans;
const geistMono = GeistMono;

export const metadata: Metadata = {
  title: 'BCL OneCampus ERP',
  description: 'One unified platform for the entire campus ecosystem',
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png', sizes: '512x512' },
      { url: '/branding/basecode-labs-logo.png', type: 'image/png' },
    ],
    apple: [{ url: '/branding/basecode-labs-logo.png', type: 'image/png' }],
    shortcut: '/favicon.png',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script id="theme-fouc" strategy="beforeInteractive">
          {THEME_FOUC_SCRIPT}
        </Script>
      </head>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} max-w-full overflow-x-hidden antialiased`}
      >
        <AppProviders>
          <Suspense fallback={null}>{children}</Suspense>
        </AppProviders>
      </body>
    </html>
  );
}

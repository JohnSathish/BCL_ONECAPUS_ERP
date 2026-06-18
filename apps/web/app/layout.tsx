import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Script from 'next/script';
import { Suspense } from 'react';
import { AppProviders } from '@/components/providers/app-providers';
import { THEME_FOUC_SCRIPT } from '@/lib/theme/css-variables';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'BCL OneCampus ERP',
  description: 'One unified platform for the entire campus ecosystem',
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

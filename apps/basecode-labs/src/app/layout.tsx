import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { COMPANY } from '@/lib/company';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? 'https://basecodelabs.com'),
  title: {
    default:
      'BaseCode Labs Pvt. Ltd. | Software, ERP & Digital Solutions in Tamil Nadu & Meghalaya',
    template: '%s | BaseCode Labs',
  },
  description:
    'BaseCode Labs builds websites, BCL OneCampus ERP, Android apps and digital infrastructure for schools, colleges and businesses. Offices in Bhuvanagiri, Tamil Nadu and Tura, Meghalaya.',
  keywords: [
    'BaseCode Labs',
    'Tamil Nadu software company',
    'Meghalaya software company',
    'Tura software development',
    'Bhuvanagiri IT company',
    'school ERP India',
    'college website Meghalaya',
    'BCL OneCampus ERP',
    'school management software Tamil Nadu',
    'Android app development Meghalaya',
  ],
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    siteName: COMPANY.legalName,
    title: COMPANY.headline,
    description: COMPANY.subheading,
  },
  twitter: {
    card: 'summary_large_image',
    title: COMPANY.legalName,
    description: COMPANY.subheading,
  },
  robots: { index: true, follow: true },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48' },
      { url: '/favicon-32.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
    shortcut: ['/favicon.ico'],
  },
  manifest: '/site.webmanifest',
  verification: {
    google: 'aT9Dgcn7v8Qz0mSvKt8TfV9nrkrbjEA7g5VCwWhMuWg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: COMPANY.legalName,
    url: COMPANY.website,
    logo: `${COMPANY.website}/icon-512.png`,
    image: `${COMPANY.website}/brand/bcl-logo-official.jpg`,
    email: COMPANY.email,
    telephone: COMPANY.phoneDisplay,
    slogan: COMPANY.tagline,
    address: [
      {
        '@type': 'PostalAddress',
        streetAddress: COMPANY.registeredOffice.line1,
        addressRegion: 'Tamil Nadu',
        addressCountry: 'IN',
      },
      {
        '@type': 'PostalAddress',
        streetAddress: COMPANY.operationalOffice.line1,
        addressLocality: 'Tura',
        postalCode: '794002',
        addressRegion: 'Meghalaya',
        addressCountry: 'IN',
      },
    ],
    areaServed: ['Tamil Nadu', 'Meghalaya', 'India'],
  };

  return (
    <html lang="en-IN">
      <body className={`${jakarta.variable} antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}

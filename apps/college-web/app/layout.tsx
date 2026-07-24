import type { Metadata, Viewport } from 'next';
import { Inter, Libre_Baskerville } from 'next/font/google';
import localFont from 'next/font/local';
import { Header } from '@/components/interactive';
import { SiteFooter } from '@/components/site-footer';
import { getCollegeContent, siteUrl } from '@/lib/content';
import { getHeaderNavigation, getUtilityNavigation } from '@/lib/menus';
import './globals.css';
import './site-footer.css';
import './information-hub.css';
import './about-college.css';
import './principal-message.css';
import './principal-feature.css';
import './coat-of-arms.css';
import './news-events.css';
import './student-support.css';
import './short-term-courses.css';
import './departments-showcase.css';
import './announcements.css';
import './why-choose-us.css';
import './feature-icons.css';
import './pagination.css';
import './voices-of-bosco.css';
import './sister-institutions.css';
import './inner-page.css';
import './administration.css';
import './leadership-profiles.css';
import './biography-feature.css';
import './important-links.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});
const serif = Libre_Baskerville({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
  weight: ['400', '700'],
  style: ['normal', 'italic'],
});
const oswald = localFont({
  src: [
    { path: './fonts/oswald-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/oswald-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/oswald-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: './fonts/oswald-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-nav',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'Don Bosco College Tura', template: '%s | Don Bosco College Tura' },
  description:
    'A premier institution of higher education in Tura, Meghalaya, committed to academic excellence, character formation and holistic development.',
  keywords: ['Don Bosco College Tura', 'college in Meghalaya', 'higher education Tura'],
  alternates: { canonical: '/' },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    type: 'website',
    siteName: 'Don Bosco College Tura',
    url: siteUrl,
    images: ['/images/campus-hero.webp'],
  },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [navigation, utilityLinks, content] = await Promise.all([
    getHeaderNavigation(),
    getUtilityNavigation(),
    getCollegeContent(),
  ]);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollegeOrUniversity',
    name: 'Don Bosco College Tura',
    url: siteUrl,
    logo: `${siteUrl}/images/college-logo.png`,
    email: content.homepageCms.footer.contactEmail,
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Tura',
      addressRegion: 'Meghalaya',
      postalCode: '794001',
      addressCountry: 'IN',
    },
  };
  return (
    <html lang="en">
      <body className={`${inter.variable} ${serif.variable} ${oswald.variable}`}>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Header
          navigation={navigation}
          utilityLinks={utilityLinks}
          headerCtas={content.homepageCms.headerCtas}
        />
        {children}
        <SiteFooter
          footer={content.homepageCms.footer}
          headerCtas={content.homepageCms.headerCtas}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  );
}

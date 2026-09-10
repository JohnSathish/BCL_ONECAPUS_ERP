import { headers } from 'next/headers';
import { LandingPage } from '@/components/landing/landing-page';
import { isSchoolWebPublicHost, schoolHostFromRequestHeaders } from '@/lib/school-web/hosts';
import SchoolSiteLayout, { generateMetadata as schoolSiteMetadata } from './school-site/layout';
import SchoolSiteHomePage from './school-site/page';

export async function generateMetadata() {
  const host = schoolHostFromRequestHeaders(await headers());
  if (isSchoolWebPublicHost(host)) return schoolSiteMetadata();
  return {
    title: {
      default: 'Campus ERP',
      template: '%s',
    },
    description: 'Smart Education Management Platform',
  };
}

/** Shared Next `/` — school public hosts must never see the OneCampus marketing landing. */
export default async function HomePage() {
  const host = schoolHostFromRequestHeaders(await headers());
  if (isSchoolWebPublicHost(host)) {
    return (
      <SchoolSiteLayout>
        <SchoolSiteHomePage />
      </SchoolSiteLayout>
    );
  }
  return <LandingPage />;
}

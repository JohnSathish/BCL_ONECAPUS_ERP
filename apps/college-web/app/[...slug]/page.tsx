import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BiographyFeature, parseBiographyHtml } from '@/components/biography-feature';
import { HistoryTimeline, InnerPageShell } from '@/components/inner-page-shell';
import { LeadershipProfiles, parseLeadershipProfiles } from '@/components/leadership-profiles';
import { getCmsPage } from '@/lib/content';

type Props = { params: Promise<{ slug: string[] }> };

const names: Record<string, string> = {
  about: 'About Us',
  academics: 'Academics',
  admission: 'Admission',
  'campus-life': 'Campus Life',
  research: 'Research',
  facilities: 'Facilities',
  history: 'History',
  'vision-mission': 'Vision & Mission',
  objectives: 'Objectives',
  philosophy: 'Philosophy',
  management: 'Management',
  affiliation: 'Affiliation',
  founder: 'Founder',
  'rector-major': 'Our Rector Major',
  'db-higher-education': 'DB Higher Education in India',
  'former-principals': 'Former Principals',
  'former-vice-principals': 'Former Vice Principals',
  principal: 'Principal’s Desk',
  administration: 'Administration',
  departments: 'Departments',
  programmes: 'Programmes',
  apply: 'Apply Online',
  contact: 'Contact Us',
  iqac: 'Internal Quality Assurance Cell',
  naac: 'NAAC',
  news: 'News & Events',
  downloads: 'Downloads',
  privacy: 'Privacy Policy',
  accessibility: 'Accessibility',
  students: 'Student Corner',
  staff: 'Staff',
  alumni: 'Alumni',
  careers: 'Careers',
  examination: 'Examination',
  erp: 'ERP Login',
  search: 'Search',
};

function labelFor(part: string) {
  return names[part] ?? part.replaceAll('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function titleFor(slug: string[]) {
  return labelFor(slug.at(-1) ?? 'Page');
}

function breadcrumbsFor(slug: string[]) {
  const crumbs: Array<{ label: string; href?: string }> = [{ label: 'Home', href: '/' }];
  slug.forEach((part, index) => {
    const href = `/${slug.slice(0, index + 1).join('/')}`;
    const isLast = index === slug.length - 1;
    crumbs.push({
      label: labelFor(part),
      href: isLast ? undefined : href,
    });
  });
  return crumbs;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const cms = await getCmsPage(`/${slug.join('/')}`);
  return {
    title: cms?.seoTitle || cms?.title || titleFor(slug),
    description:
      cms?.seoDescription ||
      cms?.excerpt ||
      `Learn more about ${titleFor(slug)} at Don Bosco College Tura.`,
    keywords: cms?.seoKeywords,
  };
}

export default async function InnerPage({ params }: Props) {
  const { slug } = await params;
  if (!slug.length || slug.some((part) => part.startsWith('.'))) notFound();
  const cms = await getCmsPage(`/${slug.join('/')}`);
  const title = cms?.title || titleFor(slug);
  const path = `/${slug.join('/')}`;
  const isHistory = path === '/about/history';
  const isLeadershipProfiles =
    path === '/about/former-principals' || path === '/about/former-vice-principals';
  const isFounder = path === '/about/founder';
  const isRectorMajor = path === '/about/rector-major';
  const leadershipProfiles =
    isLeadershipProfiles && cms?.bodyHtml ? parseLeadershipProfiles(cms.bodyHtml) : [];
  const biography =
    (isFounder || isRectorMajor) && cms?.bodyHtml
      ? {
          ...parseBiographyHtml(cms.bodyHtml),
          ...(isFounder
            ? {
                highlight:
                  'His education rests on three great principles: reason, religion, and loving kindness.',
              }
            : {
                facts: [
                  { label: 'Born', value: '21 August 1960, Asturias, Spain' },
                  { label: 'Ordained', value: '4 July 1987, León' },
                  { label: 'Rector Major', value: 'Elected 25 March 2014' },
                  { label: 'Re-elected', value: '2020 for a further six years' },
                ],
              }),
        }
      : null;

  return (
    <InnerPageShell
      title={title}
      breadcrumbs={breadcrumbsFor(slug)}
      afterArticle={isHistory ? <HistoryTimeline /> : null}
    >
      {leadershipProfiles.length ? (
        <LeadershipProfiles
          title={title}
          subtitle="Honoring the leaders who shaped our institution."
          profiles={leadershipProfiles}
        />
      ) : biography ? (
        <BiographyFeature
          title={isFounder ? 'St. John Bosco' : 'Ángel Fernández Artime'}
          eyebrow={isFounder ? 'Founder of the Salesians' : '10th Successor of Don Bosco'}
          data={biography}
        />
      ) : cms?.bodyHtml ? (
        <div dangerouslySetInnerHTML={{ __html: cms.bodyHtml }} />
      ) : (
        <>
          <h2>{title}</h2>
          <p>
            At Don Bosco College Tura, {title.toLowerCase()} reflects our commitment to academic
            excellence, human formation and service to society. Our approach places students at the
            centre of a supportive and intellectually vibrant community.
          </p>
          <p>
            This section is connected to the college content service and is ready for published CMS
            content. Until that content is available, this carefully prepared information ensures
            every public route remains useful and dependable.
          </p>
          <h2>Learning with purpose</h2>
          <p>
            Inspired by the educational vision of St. John Bosco, we create opportunities for young
            people to grow in knowledge, character, leadership and compassion.
          </p>
          <ul>
            <li>Qualified and committed faculty</li>
            <li>Inclusive, student-centred learning</li>
            <li>Strong academic and pastoral support</li>
            <li>Opportunities for research, service and leadership</li>
          </ul>
        </>
      )}
    </InnerPageShell>
  );
}

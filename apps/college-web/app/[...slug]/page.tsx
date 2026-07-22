import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ContactForm } from '@/components/contact-form';
import { getCmsPage } from '@/lib/content';

type Props = { params: Promise<{ slug: string[] }> };

const names: Record<string, string> = {
  about: 'About Us',
  academics: 'Academics',
  admission: 'Admission',
  'campus-life': 'Campus Life',
  research: 'Research',
  facilities: 'Facilities',
  history: 'Our Heritage',
  principal: 'Principal’s Desk',
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

function titleFor(slug: string[]) {
  return (
    names[slug.at(-1) ?? ''] ??
    slug
      .at(-1)!
      .replaceAll('-', ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
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
  const isContact = slug.join('/') === 'contact';
  return (
    <main id="main">
      <header className="inner-hero">
        <div className="shell">
          <div className="breadcrumbs">
            <Link href="/">Home</Link> / {slug.map((part) => names[part] ?? part).join(' / ')}
          </div>
          <span className="eyebrow gold">Don Bosco College Tura</span>
          <h1>{title}</h1>
        </div>
      </header>
      <div className="content-page shell">
        <article className="prose">
          {isContact ? (
            <>
              <h2>We would love to hear from you</h2>
              <p>
                Contact the college for admissions, academic enquiries, campus visits or general
                information.
              </p>
              <ContactForm />
            </>
          ) : cms?.bodyHtml ? (
            <>
              <p className="lead">{cms.excerpt}</p>
              <div dangerouslySetInnerHTML={{ __html: cms.bodyHtml }} />
            </>
          ) : (
            <>
              <h2>{title}</h2>
              <p>
                At Don Bosco College Tura, {title.toLowerCase()} reflects our commitment to academic
                excellence, human formation and service to society. Our approach places students at
                the centre of a supportive and intellectually vibrant community.
              </p>
              <p>
                This section is connected to the college content service and is ready for published
                CMS content. Until that content is available, this carefully prepared information
                ensures every public route remains useful and dependable.
              </p>
              <h2>Learning with purpose</h2>
              <p>
                Inspired by the educational vision of St. John Bosco, we create opportunities for
                young people to grow in knowledge, character, leadership and compassion.
              </p>
              <ul>
                <li>Qualified and committed faculty</li>
                <li>Inclusive, student-centred learning</li>
                <li>Strong academic and pastoral support</li>
                <li>Opportunities for research, service and leadership</li>
              </ul>
            </>
          )}
        </article>
        <aside className="side-card">
          <h2>Quick links</h2>
          <Link href="/admission/apply">Apply for admission</Link>
          <Link href="/academics/programmes">Explore programmes</Link>
          <Link href="/news">News & notices</Link>
          <Link href="/downloads">Downloads</Link>
          <Link href="/contact">Contact the college</Link>
        </aside>
      </div>
    </main>
  );
}

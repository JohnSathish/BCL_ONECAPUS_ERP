import { SchoolInteriorPage } from '@/components/school-web/school-interior-page';
import { schoolWebPath } from '@/lib/school-web/paths';
import type { SchoolWebBundle } from '@/lib/school-web/public';
import type { SeoCrumb } from '@/lib/school-web/seo';

export function parseAboutParagraphs(paragraphs: string[]) {
  const anthemPara = paragraphs.find((p) => /school anthem/i.test(p));
  const aimPara = paragraphs.find(
    (p) => /\baim\b/i.test(p) && /handbook|personality|noblest/i.test(p),
  );
  const body = paragraphs.filter((p) => p !== anthemPara && p !== aimPara);
  let verse = '';
  if (anthemPara) {
    const quoted = anthemPara.match(/[“"]([^”"]+)[”"]/);
    verse = (quoted?.[1] || anthemPara.replace(/^.*?anthem:\s*/i, '')).trim();
  }
  return { body, aim: aimPara || '', verse };
}

export function SchoolAboutInterior({
  title,
  paragraphs,
  extrasJson,
  seoJson,
  crumbs,
  site,
  host,
}: {
  title: string;
  paragraphs: string[];
  extrasJson: Record<string, unknown>;
  seoJson?: unknown;
  crumbs?: SeoCrumb[];
  site: SchoolWebBundle['site'];
  host?: string | null;
}) {
  const { body, aim, verse } = parseAboutParagraphs(paragraphs);
  const explore = [
    {
      href: '/history',
      label: 'History',
      text: 'From a Holy Cross pre-nursery in 2006 to Class XI in 2026.',
    },
    {
      href: '/vision-mission',
      label: 'Vision & mission',
      text: 'Catholic formation in knowledge, service and light.',
    },
    {
      href: '/principal',
      label: 'Principal’s message',
      text: 'A word from Fr. Bromith Bernard G. Sangma.',
    },
    {
      href: '/facilities',
      label: 'Facilities',
      text: 'Classrooms, academies, playfields and campus amenities.',
    },
  ];

  return (
    <SchoolInteriorPage
      slug="about"
      kicker="ABOUT THE SCHOOL"
      title={title}
      lede={`A Catholic school of St. Luke’s Parish, Diocese of Tura — from a Walbakgre pre-nursery in 2006 to Class XI today.`}
      extrasJson={extrasJson}
      seoJson={seoJson}
      crumbs={crumbs}
      site={site}
      host={host}
      showExplore={false}
      facts={[
        { value: '2006', label: 'Pre-nursery at Walbakgre' },
        { value: '2010', label: 'Named St. Luke’s School' },
        { value: 'XI', label: 'Higher Secondary from 2026' },
        { value: '500+', label: 'Taekwondo Academy enrolment' },
      ]}
    >
      <div className="sls-prose sls-prose-wide">
        {body.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
      {aim ? (
        <blockquote className="sls-about-aim">
          <p className="sls-kicker">Aim of the institution</p>
          <p>
            {aim.replace(/^Our aim, as written in the student handbook, is to /i, 'We exist to ')}
          </p>
        </blockquote>
      ) : null}
      {verse ? (
        <section className="sls-about-anthem" aria-labelledby="sls-anthem-heading">
          <p className="sls-kicker sls-kicker-line">SCHOOL ANTHEM</p>
          <h2 id="sls-anthem-heading">St. Luke’s our beloved school</h2>
          <p className="sls-about-anthem-verse">{verse}</p>
        </section>
      ) : null}
      <section className="sls-about-explore" aria-labelledby="sls-about-explore-heading">
        <p className="sls-kicker sls-kicker-line">EXPLORE</p>
        <h2 id="sls-about-explore-heading">Learn more about St. Luke’s</h2>
        <div className="sls-about-explore-grid">
          {explore.map((item) => (
            <a
              key={item.href}
              className="sls-about-explore-card"
              href={schoolWebPath(item.href, host)}
            >
              <strong>{item.label}</strong>
              <span>{item.text}</span>
            </a>
          ))}
        </div>
      </section>
    </SchoolInteriorPage>
  );
}

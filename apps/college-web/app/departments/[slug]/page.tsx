import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowRight,
  Award,
  BookOpen,
  CalendarDays,
  Download,
  FlaskConical,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
  Users,
} from 'lucide-react';
import { getAcademicDepartment } from '@/lib/academic-departments';
import { CATEGORY_LABELS, type AcademicCategory } from '@/lib/academic-types';
import { departmentIcon, departmentVisual, shortDepartmentName } from '@/lib/department-visuals';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const department = await getAcademicDepartment(slug);
  if (!department) return { title: 'Department' };
  return {
    title: `Department of ${shortDepartmentName(department.name)}`,
    description: department.tagline || department.aboutText.slice(0, 160),
  };
}

function asGallery(items: unknown[]) {
  return items
    .map((item) => {
      if (typeof item === 'string') return { src: item, alt: '', label: '' };
      if (item && typeof item === 'object') {
        const row = item as Record<string, unknown>;
        const src =
          typeof row.src === 'string' ? row.src : typeof row.url === 'string' ? row.url : null;
        if (!src) return null;
        return {
          src,
          alt: typeof row.alt === 'string' ? row.alt : '',
          label: typeof row.label === 'string' ? row.label : '',
        };
      }
      return null;
    })
    .filter(Boolean) as { src: string; alt: string; label: string }[];
}

function asDownloads(items: unknown[]) {
  return items
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const href =
        typeof row.href === 'string' ? row.href : typeof row.url === 'string' ? row.url : null;
      const label =
        typeof row.label === 'string'
          ? row.label
          : typeof row.title === 'string'
            ? row.title
            : null;
      if (!href || !label) return null;
      return { href, label };
    })
    .filter(Boolean) as { href: string; label: string }[];
}

function isUsefulTagline(tagline: string, name: string) {
  const clean = tagline.trim().toLowerCase();
  if (!clean) return false;
  const short = shortDepartmentName(name).toLowerCase();
  if (clean === short) return false;
  if (clean === `department of ${short}`) return false;
  if (clean === name.toLowerCase()) return false;
  return true;
}

export default async function DepartmentDetailPage({ params }: Props) {
  const { slug } = await params;
  const department = await getAcademicDepartment(slug);
  if (!department) notFound();

  const gallery = asGallery(Array.isArray(department.gallery) ? department.gallery : []);
  const downloads = asDownloads(Array.isArray(department.downloads) ? department.downloads : []);
  const categoryLabel =
    CATEGORY_LABELS[department.category as Exclude<AcademicCategory, 'ALL'>] ?? department.category;
  const shortName = shortDepartmentName(department.name);
  const visual = departmentVisual(department);
  const DeptIcon = departmentIcon(visual.icon);
  const showTagline = isUsefulTagline(department.tagline, department.name);
  const hasProgrammes =
    Object.keys(department.programmesByLevel || {}).length > 0 || department.programmes.length > 0;

  return (
    <main id="main" className="dept-detail-page">
      <section className="dept-page-hero" style={{ backgroundColor: visual.color }}>
        <div className="dept-page-hero-media is-icon-hero" aria-hidden>
          <span className="dept-page-hero-icon">
            <DeptIcon />
          </span>
        </div>
        <div className="shell dept-page-hero-copy">
          <div className="breadcrumbs dept-page-crumbs">
            <Link href="/">Home</Link>
            <span>/</span>
            <Link href="/departments">Departments</Link>
            <span>/</span>
            <span>{shortName}</span>
          </div>
          <div className="dept-page-hero-meta">
            <span className="dept-page-chip">{categoryLabel}</span>
            {department.establishedYear ? (
              <span className="dept-page-chip is-soft">Est. {department.establishedYear}</span>
            ) : null}
          </div>
          <h1>Department of {shortName}</h1>
          {showTagline ? <p className="dept-page-tagline">{department.tagline}</p> : null}
        </div>
      </section>

      <section className="dept-page-section dept-page-stats-wrap">
        <div className="shell dept-stat-strip" aria-label="Department statistics">
          <div>
            <Users aria-hidden />
            <strong>{department.stats.studentCount}</strong>
            <span>Students</span>
          </div>
          <div>
            <GraduationCap aria-hidden />
            <strong>{department.stats.facultyCount}</strong>
            <span>Faculty</span>
          </div>
          <div>
            <BookOpen aria-hidden />
            <strong>{department.stats.programmeCount}</strong>
            <span>Programmes</span>
          </div>
          <div>
            <Award aria-hidden />
            <strong>{department.stats.publicationCount}</strong>
            <span>Publications</span>
          </div>
        </div>
      </section>

      <section className="dept-page-section" style={{ paddingTop: 8 }}>
        <div className="shell dept-page-grid">
          <div className="dept-page-main">
            <article className="dept-panel" id="about">
              <h2>About the Department</h2>
              {department.aboutHtml ? (
                <div className="prose" dangerouslySetInnerHTML={{ __html: department.aboutHtml }} />
              ) : (
                <p className="dept-muted">
                  {department.aboutText ||
                    'Department details are managed in the ERP and will appear here when published.'}
                </p>
              )}
            </article>

            {department.hod ? (
              <article className="dept-panel" id="hod">
                <h2>Head of Department</h2>
                <div className="dept-hod-card">
                  <span className="dept-hod-photo">
                    {department.hod.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={department.hod.photoUrl} alt="" />
                    ) : (
                      <Users aria-hidden />
                    )}
                  </span>
                  <div className="dept-hod-copy">
                    <span className="dept-page-chip is-gold">HOD</span>
                    <strong>{department.hod.name}</strong>
                    <em>{department.hod.designation || 'Head of Department'}</em>
                    {department.hod.qualification ? <em>{department.hod.qualification}</em> : null}
                    <div className="dept-hod-contacts">
                      {department.hod.email ? (
                        <a href={`mailto:${department.hod.email}`}>
                          <Mail aria-hidden /> {department.hod.email}
                        </a>
                      ) : null}
                      {department.hod.phone ? (
                        <a href={`tel:${department.hod.phone}`}>
                          <Phone aria-hidden /> {department.hod.phone}
                        </a>
                      ) : null}
                    </div>
                    {department.hod.websiteSlug ? (
                      <Link
                        className="dept-inline-link"
                        href={`/departments/${department.slug}/faculty/${department.hod.websiteSlug}`}
                      >
                        View full profile <ArrowRight aria-hidden />
                      </Link>
                    ) : null}
                  </div>
                </div>
                {department.hodMessage ? (
                  <blockquote className="dept-hod-message">{department.hodMessage}</blockquote>
                ) : null}
              </article>
            ) : null}

            <article className="dept-panel" id="faculty">
              <div className="dept-panel-head">
                <h2>Faculty Members</h2>
                <span className="dept-count-pill">{department.faculty.length}</span>
              </div>
              {department.faculty.length ? (
                <div className="dept-faculty-grid">
                  {department.faculty.map((person) => {
                    const href = person.websiteSlug
                      ? `/departments/${department.slug}/faculty/${person.websiteSlug}`
                      : null;
                    const isHod = department.hod?.id === person.id;
                    const body = (
                      <>
                        <span className="dept-faculty-card-photo">
                          {person.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={person.photoUrl} alt="" />
                          ) : (
                            <Users aria-hidden />
                          )}
                        </span>
                        <div className="dept-faculty-card-copy">
                          {isHod ? <span className="dept-page-chip is-gold">HOD</span> : null}
                          <strong>{person.name}</strong>
                          <small>{person.designation || 'Faculty'}</small>
                          {person.qualification ? <small>{person.qualification}</small> : null}
                          {person.researchAreas ? (
                            <small className="dept-faculty-research">{person.researchAreas}</small>
                          ) : null}
                        </div>
                      </>
                    );
                    return href ? (
                      <Link className="dept-faculty-card" href={href} key={person.id}>
                        {body}
                      </Link>
                    ) : (
                      <div className="dept-faculty-card" key={person.id}>
                        {body}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="dept-muted">
                  Faculty profiles will appear once staff are marked visible on the website.
                </p>
              )}
            </article>

            <article className="dept-panel" id="programmes">
              <h2>Programmes Offered</h2>
              {Object.keys(department.programmesByLevel || {}).length ? (
                <div className="dept-programme-groups">
                  {Object.entries(department.programmesByLevel).map(([level, programmes]) => (
                    <div key={level}>
                      <h3>{level}</h3>
                      <ul className="dept-list">
                        {programmes.map((programme) => (
                          <li key={`${level}-${programme.code}`}>
                            <BookOpen aria-hidden />
                            <div>
                              <strong>{programme.name}</strong>
                              <span>{programme.code}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : department.programmes.length ? (
                <ul className="dept-list">
                  {department.programmes.map((programme) => (
                    <li key={programme.code}>
                      <BookOpen aria-hidden />
                      <div>
                        <strong>{programme.name}</strong>
                        <span>
                          {programme.code}
                          {programme.level ? ` · ${programme.level}` : ''}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="dept-muted">No programmes linked yet.</p>
              )}
            </article>

            {department.activities.length ? (
              <article className="dept-panel" id="activities">
                <h2>Department Activities</h2>
                <ul className="dept-list">
                  {department.activities.map((activity) => (
                    <li key={activity.id}>
                      <CalendarDays aria-hidden />
                      <div>
                        <strong>{activity.title}</strong>
                        <span>
                          {activity.activityType}
                          {activity.eventDate
                            ? ` · ${new Date(activity.eventDate).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}`
                            : ''}
                          {activity.venue ? ` · ${activity.venue}` : ''}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </article>
            ) : null}

            {department.publications.length || department.awards.length ? (
              <article className="dept-panel" id="achievements">
                <h2>Achievements &amp; Publications</h2>
                {department.awards.length ? (
                  <div className="dept-achieve-block">
                    <h3>Awards</h3>
                    <ul className="dept-list">
                      {department.awards.map((award) => (
                        <li key={award.id}>
                          <Award aria-hidden />
                          <div>
                            <strong>{award.title}</strong>
                            <span>
                              {award.recipientName}
                              {award.organization ? ` · ${award.organization}` : ''}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {department.publications.length ? (
                  <div className="dept-achieve-block">
                    <h3>Publications</h3>
                    <ul className="dept-list">
                      {department.publications.map((pub) => (
                        <li key={pub.id}>
                          <BookOpen aria-hidden />
                          <div>
                            <strong>{pub.title}</strong>
                            <span>
                              {pub.authorName}
                              {pub.journal ? ` · ${pub.journal}` : ''}
                              {pub.publicationType ? ` · ${pub.publicationType}` : ''}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </article>
            ) : null}

            <article className="dept-panel" id="gallery">
              <h2>Laboratories &amp; Gallery</h2>
              {gallery.length ? (
                <div className="dept-gallery">
                  {gallery.map((item) => (
                    <figure key={item.src}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.src} alt={item.alt || item.label || ''} />
                      {item.label ? <figcaption>{item.label}</figcaption> : null}
                    </figure>
                  ))}
                </div>
              ) : (
                <div className="dept-empty-soft">
                  <FlaskConical aria-hidden />
                  <p>Gallery and laboratory images can be published from the department profile.</p>
                </div>
              )}
            </article>

            <article className="dept-panel" id="timetable">
              <h2>Timetable</h2>
              <div className="dept-empty-soft">
                <CalendarDays aria-hidden />
                <p>
                  {department.timetable?.available
                    ? 'Current timetable is available from the academic timetable module.'
                    : 'Timetable will sync from the ERP timetable module when published for the website.'}
                </p>
              </div>
            </article>
          </div>

          <aside className="dept-page-aside">
            <nav className="dept-panel dept-toc" aria-label="On this page">
              <h2>On this page</h2>
              <a href="#about">About</a>
              {department.hod ? <a href="#hod">Head of Department</a> : null}
              <a href="#faculty">Faculty</a>
              {hasProgrammes ? <a href="#programmes">Programmes</a> : null}
              {department.activities.length ? <a href="#activities">Activities</a> : null}
              {department.publications.length || department.awards.length ? (
                <a href="#achievements">Achievements</a>
              ) : null}
              <a href="#gallery">Gallery</a>
              <a href="#timetable">Timetable</a>
            </nav>

            <div className="dept-panel">
              <h2>Contact</h2>
              <ul className="dept-list">
                {department.contact.officeLocation ? (
                  <li>
                    <MapPin aria-hidden />
                    <div>
                      <strong>Office</strong>
                      <span>{department.contact.officeLocation}</span>
                    </div>
                  </li>
                ) : null}
                {department.contact.email ? (
                  <li>
                    <Mail aria-hidden />
                    <div>
                      <strong>Email</strong>
                      <span>
                        <a href={`mailto:${department.contact.email}`}>
                          {department.contact.email}
                        </a>
                      </span>
                    </div>
                  </li>
                ) : null}
                {department.contact.phone ? (
                  <li>
                    <Phone aria-hidden />
                    <div>
                      <strong>Phone</strong>
                      <span>
                        <a href={`tel:${department.contact.phone}`}>{department.contact.phone}</a>
                      </span>
                    </div>
                  </li>
                ) : null}
                {!department.contact.officeLocation &&
                !department.contact.email &&
                !department.contact.phone ? (
                  <li>
                    <MapPin aria-hidden />
                    <div>
                      <span>Department office details will appear when published in ERP.</span>
                    </div>
                  </li>
                ) : null}
              </ul>
            </div>

            <div className="dept-panel">
              <h2>Downloads</h2>
              {downloads.length ? (
                <ul className="dept-list">
                  {downloads.map((item) => (
                    <li key={item.href}>
                      <Download aria-hidden />
                      <div>
                        <a href={item.href} target="_blank" rel="noopener noreferrer">
                          {item.label}
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="dept-muted">
                  Syllabus, handbook and forms can be attached from the website department profile.
                </p>
              )}
            </div>

            <div className="dept-panel">
              <h2>Quick links</h2>
              <div className="dept-quick-links">
                <Link href="/departments">
                  All departments <ArrowRight aria-hidden />
                </Link>
                <Link href="/admission/apply">
                  Apply for admission <ArrowRight aria-hidden />
                </Link>
                <Link href="/news">
                  News &amp; events <ArrowRight aria-hidden />
                </Link>
                <Link href="/contact">
                  Contact the college <ArrowRight aria-hidden />
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

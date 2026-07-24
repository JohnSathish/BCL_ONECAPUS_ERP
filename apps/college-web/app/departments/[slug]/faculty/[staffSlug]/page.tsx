import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowRight,
  Award,
  BookOpen,
  Briefcase,
  CalendarDays,
  ExternalLink,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
  Users,
} from 'lucide-react';
import { getAcademicFaculty } from '@/lib/academic-departments';
import { shortDepartmentName } from '@/lib/department-visuals';

type Props = { params: Promise<{ slug: string; staffSlug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { staffSlug } = await params;
  const faculty = await getAcademicFaculty(staffSlug);
  if (!faculty) return { title: 'Faculty Profile' };
  return {
    title: faculty.name,
    description: [faculty.designation, faculty.qualification, faculty.department?.name]
      .filter(Boolean)
      .join(' · '),
  };
}

export default async function FacultyProfilePage({ params }: Props) {
  const { slug, staffSlug } = await params;
  const faculty = await getAcademicFaculty(staffSlug);
  if (!faculty) notFound();

  if (faculty.department?.slug && faculty.department.slug !== slug) {
    notFound();
  }

  const departmentName = faculty.department?.name
    ? shortDepartmentName(faculty.department.name)
    : null;
  const hasContact =
    Boolean(faculty.email) ||
    Boolean(faculty.phone) ||
    Boolean(faculty.officeLocation) ||
    Boolean(faculty.googleScholarUrl) ||
    Boolean(faculty.orcidUrl);

  return (
    <main id="main" className="faculty-profile-page">
      <section className="faculty-hero">
        <div className="shell faculty-hero-copy">
          <div className="breadcrumbs faculty-crumbs">
            <Link href="/">Home</Link>
            <span>/</span>
            <Link href="/departments">Departments</Link>
            {faculty.department?.slug ? (
              <>
                <span>/</span>
                <Link href={`/departments/${faculty.department.slug}`}>{departmentName}</Link>
              </>
            ) : null}
            <span>/</span>
            <span>{faculty.name}</span>
          </div>
          <span className="dept-page-chip">Faculty Profile</span>
          <h1>{faculty.name}</h1>
          <p>
            {[faculty.designation, departmentName ? `Department of ${departmentName}` : null]
              .filter(Boolean)
              .join(' · ') || 'Faculty member'}
          </p>
        </div>
      </section>

      <section className="dept-page-section">
        <div className="shell dept-page-grid">
          <div className="faculty-main">
            <article className="dept-panel">
              <div className="faculty-identity">
                <span className="faculty-identity-photo">
                  {faculty.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={faculty.photoUrl} alt="" />
                  ) : (
                    <Users aria-hidden />
                  )}
                </span>
                <div className="faculty-identity-copy">
                  <strong>{faculty.name}</strong>
                  {faculty.designation ? (
                    <span className="faculty-meta-row">
                      <Briefcase aria-hidden /> {faculty.designation}
                    </span>
                  ) : null}
                  {faculty.qualification ? (
                    <span className="faculty-meta-row">
                      <GraduationCap aria-hidden /> {faculty.qualification}
                    </span>
                  ) : null}
                  {faculty.experienceYears != null ? (
                    <span className="faculty-meta-row">
                      {faculty.experienceYears} years experience
                    </span>
                  ) : null}
                  {faculty.specialization ? (
                    <span className="faculty-meta-row is-muted">
                      Specialization: {faculty.specialization}
                    </span>
                  ) : null}
                  {faculty.researchAreas ? (
                    <span className="faculty-meta-row is-muted">
                      Research: {faculty.researchAreas}
                    </span>
                  ) : null}
                </div>
              </div>
            </article>

            {hasContact ? (
              <article className="dept-panel">
                <h2>Contact</h2>
                <ul className="dept-list">
                  {faculty.email ? (
                    <li>
                      <Mail aria-hidden />
                      <div>
                        <strong>Email</strong>
                        <span>
                          <a href={`mailto:${faculty.email}`}>{faculty.email}</a>
                        </span>
                      </div>
                    </li>
                  ) : null}
                  {faculty.phone ? (
                    <li>
                      <Phone aria-hidden />
                      <div>
                        <strong>Phone</strong>
                        <span>
                          <a href={`tel:${faculty.phone}`}>{faculty.phone}</a>
                        </span>
                      </div>
                    </li>
                  ) : null}
                  {faculty.officeLocation ? (
                    <li>
                      <MapPin aria-hidden />
                      <div>
                        <strong>Office</strong>
                        <span>{faculty.officeLocation}</span>
                      </div>
                    </li>
                  ) : null}
                  {faculty.googleScholarUrl ? (
                    <li>
                      <ExternalLink aria-hidden />
                      <div>
                        <strong>Google Scholar</strong>
                        <span>
                          <a
                            href={faculty.googleScholarUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View profile
                          </a>
                        </span>
                      </div>
                    </li>
                  ) : null}
                  {faculty.orcidUrl ? (
                    <li>
                      <ExternalLink aria-hidden />
                      <div>
                        <strong>ORCID</strong>
                        <span>
                          <a href={faculty.orcidUrl} target="_blank" rel="noopener noreferrer">
                            View profile
                          </a>
                        </span>
                      </div>
                    </li>
                  ) : null}
                </ul>
              </article>
            ) : null}

            {faculty.qualifications?.length ? (
              <article className="dept-panel">
                <h2>Qualifications</h2>
                <ul className="dept-list">
                  {faculty.qualifications.map((item) => (
                    <li key={item.id}>
                      <GraduationCap aria-hidden />
                      <div>
                        <strong>{item.qualification}</strong>
                        {item.university || item.specialization ? (
                          <span>
                            {[item.university, item.specialization].filter(Boolean).join(' · ')}
                          </span>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </article>
            ) : null}

            {faculty.publications?.length ? (
              <article className="dept-panel">
                <h2>Publications</h2>
                <ul className="dept-list">
                  {faculty.publications.map((item) => (
                    <li key={item.id}>
                      <BookOpen aria-hidden />
                      <div>
                        <strong>{item.title}</strong>
                        {item.publicationType || item.journal ? (
                          <span>
                            {[item.publicationType, item.journal].filter(Boolean).join(' · ')}
                          </span>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </article>
            ) : null}

            {faculty.awards?.length ? (
              <article className="dept-panel">
                <h2>Awards</h2>
                <ul className="dept-list">
                  {faculty.awards.map((item) => (
                    <li key={item.id}>
                      <Award aria-hidden />
                      <div>
                        <strong>{item.title}</strong>
                        {item.organization || item.level ? (
                          <span>{[item.organization, item.level].filter(Boolean).join(' · ')}</span>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </article>
            ) : null}

            <article className="dept-panel">
              <h2>Courses &amp; Timetable</h2>
              <div className="dept-empty-soft">
                <CalendarDays aria-hidden />
                <p>
                  Teaching assignments and timetable slots will appear here when published from ERP.
                </p>
              </div>
            </article>
          </div>

          <aside className="dept-page-aside">
            <div className="dept-panel">
              <h2>Department</h2>
              {faculty.department?.href ? (
                <Link className="faculty-dept-link" href={faculty.department.href}>
                  <span>
                    <strong>{faculty.department.name}</strong>
                    <small>View department page</small>
                  </span>
                  <ArrowRight aria-hidden />
                </Link>
              ) : (
                <p className="dept-muted">{faculty.department?.name || '—'}</p>
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

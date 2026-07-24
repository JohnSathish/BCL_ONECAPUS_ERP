'use client';

import Link from 'next/link';
import { useDeferredValue, useMemo, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import {
  ArrowRight,
  Building2,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Search,
  UserRound,
  Users,
} from 'lucide-react';
import type { AcademicCategory, DepartmentCard, PublicFacultyCard } from '@/lib/academic-types';
import { CATEGORY_LABELS } from '@/lib/academic-types';
import { departmentIcon, departmentVisual, shortDepartmentName } from '@/lib/department-visuals';

type Props = {
  departments: DepartmentCard[];
};

const filters: AcademicCategory[] = ['ALL', 'ARTS', 'SCIENCE', 'COMMERCE', 'PROFESSIONAL'];

function shortName(name: string) {
  return shortDepartmentName(name);
}

function FacultyAvatarStack({
  people,
  moreCount,
  departmentSlug,
}: {
  people: PublicFacultyCard[];
  moreCount: number;
  departmentSlug: string;
}) {
  return (
    <div className="dept-avatar-stack">
      {people.slice(0, 3).map((person, index) => {
        const href =
          person.websiteSlug && departmentSlug
            ? `/departments/${departmentSlug}/faculty/${person.websiteSlug}`
            : null;
        const tipSide = index === 0 ? 'is-tip-left' : 'is-tip-right';
        const avatar = (
          <>
            <span className="dept-avatar">
              {person.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={person.photoUrl} alt="" />
              ) : (
                <Users aria-hidden />
              )}
            </span>
            <span className={`dept-avatar-tip ${tipSide}`} role="tooltip">
              <strong>{person.name}</strong>
              {person.qualification ? <em>{person.qualification}</em> : null}
              {person.designation ? <small>{person.designation}</small> : null}
            </span>
          </>
        );
        return href ? (
          <Link
            key={person.id}
            href={href}
            className="dept-avatar-link"
            aria-label={`${person.name}${person.designation ? `, ${person.designation}` : ''}`}
          >
            {avatar}
          </Link>
        ) : (
          <span
            key={person.id}
            className="dept-avatar-link"
            tabIndex={0}
            aria-label={`${person.name}${person.designation ? `, ${person.designation}` : ''}`}
          >
            {avatar}
          </span>
        );
      })}
      {moreCount > 0 ? <span className="dept-avatar-more">+{moreCount}</span> : null}
    </div>
  );
}

function DepartmentCompactCard({ department }: { department: DepartmentCard }) {
  const category =
    CATEGORY_LABELS[department.category as Exclude<AcademicCategory, 'ALL'>] ?? department.category;
  const visual = departmentVisual(department);
  const Icon = departmentIcon(visual.icon);
  const programmeCount = department.stats.programmeCount || department.programmes.length;

  return (
    <article className="dept-card dept-card-compact">
      <div className="dept-card-media is-icon-header" style={{ backgroundColor: visual.color }}>
        <div className="dept-card-media-bar">
          <span className="dept-card-icon" aria-hidden>
            <Icon />
          </span>
          <div className="dept-card-media-copy">
            <h3>{shortName(department.name)}</h3>
            <span className="dept-card-category-pill">{category}</span>
          </div>
        </div>
        <Link className="dept-card-hover-cta" href={department.href}>
          View Department <ArrowRight aria-hidden />
        </Link>
      </div>

      <div className="dept-card-body">
        {department.hod ? (
          <p className="dept-card-hod-line">
            <UserRound aria-hidden />
            <span>
              HOD: <strong>{department.hod.name}</strong>
            </span>
          </p>
        ) : (
          <p className="dept-card-hod-line is-muted">
            <UserRound aria-hidden />
            <span>Head of Department TBA</span>
          </p>
        )}

        <p className="dept-card-metrics">
          <span>
            <Users aria-hidden /> {department.stats.facultyCount} Faculty
          </span>
          <span aria-hidden>•</span>
          <span>
            <GraduationCap aria-hidden /> {department.stats.studentCount} Students
          </span>
          <span aria-hidden>•</span>
          <span>
            <Building2 aria-hidden /> {programmeCount} Programme{programmeCount === 1 ? '' : 's'}
          </span>
        </p>

        {department.featuredFaculty.length ? (
          <div className="dept-card-faculty-row">
            <FacultyAvatarStack
              people={department.featuredFaculty}
              moreCount={department.moreFacultyCount}
              departmentSlug={department.slug}
            />
            <span className="dept-card-faculty-label">Faculty</span>
          </div>
        ) : null}

        <Link className="dept-card-cta" href={department.href}>
          Explore Department <ArrowRight aria-hidden />
        </Link>
      </div>
    </article>
  );
}

export function DepartmentsShowcase({ departments }: Props) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<AcademicCategory>('ALL');
  const deferredQuery = useDeferredValue(query);
  const [emblaRef, embla] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
  });

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return departments.filter((dept) => {
      if (category !== 'ALL' && dept.category.toUpperCase() !== category) return false;
      if (!q) return true;
      return (
        dept.name.toLowerCase().includes(q) ||
        dept.tagline.toLowerCase().includes(q) ||
        dept.code.toLowerCase().includes(q) ||
        dept.hod?.name.toLowerCase().includes(q) ||
        dept.featuredFaculty.some((f) => f.name.toLowerCase().includes(q))
      );
    });
  }, [departments, deferredQuery, category]);

  if (!departments.length) {
    return (
      <section className="dept-showcase" aria-labelledby="dept-showcase-heading">
        <div className="shell">
          <header className="dept-showcase-head">
            <span className="eyebrow gold">Academic Departments</span>
            <h2 id="dept-showcase-heading" className="display">
              Explore Our Academic Departments
            </h2>
            <p>
              Department pages will appear here once they are published from the ERP website module.
            </p>
          </header>
        </div>
      </section>
    );
  }

  return (
    <section className="dept-showcase" aria-labelledby="dept-showcase-heading">
      <div className="shell">
        <header className="dept-showcase-head">
          <div className="dept-showcase-head-row">
            <div>
              <span className="eyebrow gold">Academic Departments</span>
              <h2 id="dept-showcase-heading" className="display">
                Explore Our Academic Departments
              </h2>
              <p>
                Choose from our diverse academic disciplines guided by experienced faculty and
                modern learning resources.
              </p>
            </div>
            <Link className="text-link" href="/departments">
              All departments →
            </Link>
          </div>

          <div className="dept-showcase-tools">
            <label className="dept-search">
              <Search aria-hidden />
              <span className="sr-only">Search department</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search Department"
              />
            </label>
            <div className="dept-filters" role="tablist" aria-label="Department category">
              {filters.map((item) => (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  aria-selected={category === item}
                  className={category === item ? 'is-active' : undefined}
                  onClick={() => setCategory(item)}
                >
                  {item === 'ALL' ? 'All' : CATEGORY_LABELS[item]}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="dept-showcase-desktop">
          {filtered.map((department) => (
            <DepartmentCompactCard key={department.id} department={department} />
          ))}
          {!filtered.length ? (
            <p className="dept-empty">No departments match your search.</p>
          ) : null}
        </div>

        <div className="dept-showcase-mobile">
          <button
            type="button"
            className="dept-mobile-arrow"
            aria-label="Previous departments"
            onClick={() => embla?.scrollPrev()}
          >
            <ChevronLeft />
          </button>
          <div className="dept-mobile-viewport" ref={emblaRef}>
            <div className="dept-mobile-track">
              {filtered.map((department) => (
                <div className="dept-mobile-slide" key={department.id}>
                  <DepartmentCompactCard department={department} />
                </div>
              ))}
            </div>
          </div>
          <button
            type="button"
            className="dept-mobile-arrow"
            aria-label="Next departments"
            onClick={() => embla?.scrollNext()}
          >
            <ChevronRight />
          </button>
        </div>

        <div className="dept-showcase-footer">
          <Link className="button" href="/departments">
            <Building2 aria-hidden /> View all departments <ArrowRight aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}

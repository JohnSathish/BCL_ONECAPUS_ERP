import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Building2 } from 'lucide-react';
import { DepartmentsShowcase } from '@/components/departments-showcase';
import { listAcademicDepartments } from '@/lib/academic-departments';

export const metadata: Metadata = {
  title: 'Departments',
  description:
    'Explore academic departments, faculty, programmes and research at Don Bosco College, Tura.',
};

export default async function DepartmentsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const params = await searchParams;
  const departments = await listAcademicDepartments({
    q: params.q,
    category: params.category,
  });

  return (
    <main id="main">
      <header className="inner-hero">
        <div className="shell">
          <div className="breadcrumbs">
            <Link href="/">Home</Link>
            <span>/</span>
            <span>Departments</span>
          </div>
          <span className="eyebrow gold">Academic Departments</span>
          <h1>Explore Our Academic Departments</h1>
          <p>
            Choose from our diverse academic disciplines guided by experienced faculty and modern
            learning resources.
          </p>
        </div>
      </header>
      <DepartmentsShowcase departments={departments} />
      {!departments.length ? (
        <section className="section shell">
          <div className="dept-panel">
            <h2>
              <Building2 aria-hidden /> No published departments yet
            </h2>
            <p>
              Publish departments from the ERP Website CMS (Departments) to make them appear here
              automatically.
            </p>
            <Link className="text-link" href="/">
              Back to home <ArrowRight />
            </Link>
          </div>
        </section>
      ) : null}
    </main>
  );
}

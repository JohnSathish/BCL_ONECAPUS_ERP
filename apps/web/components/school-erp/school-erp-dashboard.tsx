'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import {
  SCHOOL_PORTAL_BUILDING_SRC,
  SCHOOL_PORTAL_LOGO_SRC,
} from '@/lib/school-admissions-branding';
import { SCHOOL_ERP_SESSION_LABEL } from '@/lib/school-erp/nav';
import {
  getActiveDashboardWidgetIds,
  isSchoolErpModuleActive,
  isSchoolErpMultiModuleDashboard,
} from '@/lib/school-erp/modules';
import { SchoolAdmissionOverviewDashboard } from './modules/admission-overview-dashboard';

/**
 * School ERP home dashboard composer.
 *
 * - One active module (today: Admission) → focused module overview.
 * - Multiple active modules later → combined School ERP overview by stacking
 *   each module's overview widgets (no rewrite of this shell required).
 */
export function SchoolErpDashboard() {
  const user = useAuthStore((s) => s.session?.user);
  const welcomeName = user?.displayName?.trim() || user?.email?.split('@')[0] || 'Admin';
  const multiModule = isSchoolErpMultiModuleDashboard();
  const widgets = getActiveDashboardWidgetIds();

  return (
    <div className="space-y-5">
      <section className="school-erp-hero relative overflow-hidden rounded-3xl text-white shadow-sm">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${SCHOOL_PORTAL_BUILDING_SRC})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0f241c]/95 via-[#1b4d3e]/88 to-[#1b4d3e]/55" />
        <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <img
                src={SCHOOL_PORTAL_LOGO_SRC}
                alt="Tura Public School"
                width={48}
                height={58}
                className="h-12 w-auto rounded-md bg-white/10 p-1"
              />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#e8d9bf]">
                  Tura Public School, Tura
                </p>
                <p className="text-xs text-emerald-100/85">
                  Discipline | Knowledge | Service — “To Glow In Integrity”
                </p>
              </div>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Welcome back, {welcomeName}!
            </h1>
            <p className="mt-2 max-w-xl text-sm text-emerald-50/90">
              {multiModule
                ? `School ERP overview for ${SCHOOL_ERP_SESSION_LABEL}. Active modules are summarised below.`
                : `K.G. Admission 2027 for ${SCHOOL_ERP_SESSION_LABEL}. Review applications, payments, documents, and decisions from this overview.`}
            </p>
            <blockquote className="mt-4 max-w-lg border-l-2 border-[#c5a572] pl-3 text-sm italic text-emerald-50/85">
              “Education is the most powerful weapon which you can use to change the world.”
              <footer className="mt-1 text-xs not-italic text-[#e8d9bf]">— Nelson Mandela</footer>
            </blockquote>
          </div>
          <div className="justify-self-start rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm lg:justify-self-end">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e8d9bf]">
              {multiModule ? 'School ERP' : 'Nurturing Bright Futures'}
            </p>
            <p className="mt-1 text-sm text-white">
              {multiModule ? 'Multi-module overview' : 'K.G. Admission · Session 2027'}
            </p>
            {!multiModule && isSchoolErpModuleActive('admission') ? (
              <Link
                href="/admin/school-admissions"
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--school-erp-primary)] hover:bg-[#f8f1e6]"
              >
                Open applications
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {widgets.includes('admission') ? <SchoolAdmissionOverviewDashboard /> : null}

      {/* Future: register Students / Attendance / Fees overview widgets here when activated. */}
    </div>
  );
}

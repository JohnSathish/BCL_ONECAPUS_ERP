'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GraduationCap, Heart, Users } from 'lucide-react';
import { PoweredByBaseCodeLabs } from '@/components/branding/powered-by-basecode-labs';
import {
  SCHOOL_PORTAL_BUILDING_SRC,
  SCHOOL_PORTAL_LOGO_SRC,
} from '@/lib/school-admissions-branding';
import {
  SchoolAdmissionsShell,
  SchoolNeedHelpCard,
  SchoolQuoteCard,
  useSchoolPortalBranding,
} from './school-admissions-shell';
import { SchoolPortalTrafficStats } from './school-portal-traffic-stats';

const PILLARS = [
  { icon: GraduationCap, label: 'Quality Education' },
  { icon: Heart, label: 'Caring Environment' },
  { icon: Users, label: 'Values for Life' },
];

export function SchoolPublicSplit({ children }: { children: React.ReactNode }) {
  const branding = useSchoolPortalBranding();
  const pathname = usePathname();
  const isRegister = pathname?.includes('/register');

  return (
    <SchoolAdmissionsShell variant="public">
      <div className="tps-public-shell">
        <div className="tps-public-split">
          <section className="tps-public-brand" aria-label="School introduction">
            <div className="tps-public-brand-copy tps-fade-up">
              <div className="flex items-center gap-3">
                <img
                  src={SCHOOL_PORTAL_LOGO_SRC}
                  alt={branding.schoolName}
                  className="h-14 w-auto drop-shadow-sm sm:h-[4.35rem]"
                />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#1a5336]/85">
                    {branding.shortName}
                  </p>
                  <p className="truncate text-lg font-semibold leading-tight text-slate-900 sm:text-[1.35rem]">
                    {branding.schoolName}
                  </p>
                  <p className="text-xs text-slate-500">Discipline | Knowledge | Service</p>
                </div>
              </div>

              <p className="tps-public-eyebrow">K.G. Admission 2027</p>
              <h2 className="tps-serif tps-public-headline">
                Begin Your Child’s <span className="tps-bright">Bright</span> Journey With Us
              </h2>
              <p className="tps-public-lead">
                A safe, caring campus in Tura where children grow in knowledge, discipline, and
                service. Online registration for Kindergarten, Academic Session 2027.
              </p>

              <div className="tps-public-pillars">
                {PILLARS.map(({ icon: Icon, label }) => (
                  <div key={label}>
                    <span className="tps-pillar-icon">
                      <Icon className="h-[1.15rem] w-[1.15rem]" strokeWidth={2.25} />
                    </span>
                    <p className="mt-2">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="tps-public-building tps-fade-up-delay">
              <img src={SCHOOL_PORTAL_BUILDING_SRC} alt="Tura Public School building" />
              <p className="tps-script tps-public-building-quote">Nurturing Bright Futures</p>
            </div>
          </section>

          <section className="tps-public-panel" aria-label={isRegister ? 'Register' : 'Login'}>
            <div className="mb-5 flex justify-end">
              <p className="tps-script tps-public-motto">Every Child Matters</p>
            </div>

            <div className="mx-auto flex w-full max-w-xl flex-1 flex-col lg:max-w-[36rem]">
              <div className="tps-fade-up">{children}</div>
              <div id="tps-help" className="tps-public-help-grid">
                <SchoolNeedHelpCard phone={branding.helpPhone} email={branding.helpEmail} />
                <SchoolQuoteCard by="Nelson Mandela">
                  Education is the most powerful weapon which you can use to change the world.
                </SchoolQuoteCard>
              </div>
            </div>
          </section>
        </div>

        <footer className="tps-public-footer">
          <div className="tps-public-footer-row">
            <p>Affiliated to CISCE, New Delhi</p>
            <SchoolPortalTrafficStats />
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <a href="/privacy-policy.html" target="_blank" rel="noreferrer">
                Privacy Policy
              </a>
              <span className="opacity-40">|</span>
              <a href="/terms-and-conditions.html" target="_blank" rel="noreferrer">
                Terms &amp; Conditions
              </a>
              <span className="opacity-40">|</span>
              <a href="#tps-help">Help</a>
              <span className="opacity-40">|</span>
              <a
                href="/school-admissions/kg-admission-2027-instructions.html"
                target="_blank"
                rel="noreferrer"
              >
                Instructions
              </a>
              <span className="hidden opacity-40 sm:inline">|</span>
              <PoweredByBaseCodeLabs className="hidden text-white underline sm:inline" />
            </div>
          </div>
        </footer>
      </div>
    </SchoolAdmissionsShell>
  );
}

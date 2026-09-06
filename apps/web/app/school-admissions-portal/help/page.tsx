'use client';

import { SchoolApplicantNav } from '@/components/school-admissions-portal/school-applicant-nav';
import {
  SchoolNeedHelpCard,
  SchoolQuoteCard,
  useSchoolPortalBranding,
} from '@/components/school-admissions-portal/school-admissions-shell';

export default function SchoolAdmissionsHelpPage() {
  const branding = useSchoolPortalBranding();
  return (
    <SchoolApplicantNav
      sidebar={
        <>
          <SchoolNeedHelpCard phone={branding.helpPhone} email={branding.helpEmail} />
          <SchoolQuoteCard by="Anonymous">
            Every child is a different kind of flower, and all together make this world a beautiful
            garden.
          </SchoolQuoteCard>
        </>
      }
    >
      <h2 className="tps-serif text-2xl text-[#1a5336]">Help</h2>
      <p className="mt-2 text-sm text-slate-600">
        For K.G. Admission 2027, visit the school office on weekdays from 10:30 AM to 2:00 PM, or
        email the admission desk. Filled-in forms are accepted until 25 September 2026.
      </p>
      <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-700">
        <li>Use the parent email for OTP and login details. SMS OTP is not used.</li>
        <li>Keep the application number as the bank transfer reference.</li>
        <li>Upload a passport photograph of the child in school uniform.</li>
        <li>
          Full parent instructions (print or save as PDF):{' '}
          <a
            className="font-medium text-[#1a5336] underline"
            href="/school-admissions/kg-admission-2027-instructions.html"
            target="_blank"
            rel="noreferrer"
          >
            K.G. Admission 2027 instruction sheet
          </a>
        </li>
      </ul>
    </SchoolApplicantNav>
  );
}

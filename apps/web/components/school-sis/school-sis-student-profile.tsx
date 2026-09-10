'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  BookOpen,
  Bus,
  ChevronDown,
  Download,
  Droplets,
  FileText,
  GraduationCap,
  HeartPulse,
  History,
  Home,
  IdCard,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Phone,
  Printer,
  Shield,
  StickyNote,
  UserRound,
  Users,
} from 'lucide-react';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { canManageSchoolSis } from '@/lib/school-sis/permissions';
import { SCHOOL_SIS_LOGO_SRC } from '@/lib/school-erp/product';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import {
  ageFromDob,
  formatSchoolAddress,
  formatSchoolDate,
  formatSchoolDateTime,
  houseFromStudent,
  indianWhatsAppHref,
  profileCompletion,
  studentInitials,
} from '@/lib/school-sis/student-profile';
import {
  fetchSchoolSisStudent,
  fetchSchoolSisStudentDocumentFile,
  fetchSchoolSisStudentFees,
  fetchSchoolSisStudentTimetable,
  uploadSchoolSisStudentPhoto,
  type SchoolSisFeeStructure,
  type SchoolSisStudentMaster,
} from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import { SchoolSisFeeStructureCard } from '@/components/school-sis/school-sis-fee-structure-card';
import { SchoolSisTimetableGrid } from '@/components/school-sis/school-sis-timetable-grid';

type TabId =
  | 'overview'
  | 'attendance'
  | 'academics'
  | 'exams'
  | 'fees'
  | 'timetable'
  | 'health'
  | 'library'
  | 'documents'
  | 'timeline'
  | 'achievements'
  | 'discipline'
  | 'communication'
  | 'notices'
  | 'audit';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'academics', label: 'Academics' },
  { id: 'exams', label: 'Exams & Results' },
  { id: 'fees', label: 'Fees' },
  { id: 'timetable', label: 'Timetable' },
  { id: 'health', label: 'Health' },
  { id: 'library', label: 'Library' },
  { id: 'documents', label: 'Documents' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'achievements', label: 'Achievements' },
  { id: 'discipline', label: 'Discipline' },
  { id: 'communication', label: 'Communication' },
  { id: 'notices', label: 'Notices' },
  { id: 'audit', label: 'Audit Trail' },
];

function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

function currentEnrollment(row: SchoolSisStudentMaster) {
  return row.enrollments.find((e) => e.status === 'ACTIVE') ?? row.enrollments[0];
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-800">{value?.trim() || '—'}</p>
    </div>
  );
}

function Card({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="sls-profile-card">
      <div className="sls-staff-card-head">
        {Icon ? <Icon className="h-4 w-4 text-sky-700" /> : null}
        <h2>{title}</h2>
        <div className="ml-auto">{action}</div>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function ComingSoon({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
      <p className="text-sm font-semibold text-[#1a365d]">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{hint}</p>
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        Coming soon
      </p>
    </div>
  );
}

export function SchoolSisStudentProfile({ studentId }: { studentId: string }) {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.session?.user);
  const canManage = canManageSchoolSis(user?.permissions);
  const [tab, setTab] = useState<TabId>('overview');
  const [moreOpen, setMoreOpen] = useState(false);
  const [gapsOpen, setGapsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  const student = useQuery({
    queryKey: ['school-sis-student', studentId],
    queryFn: () => fetchSchoolSisStudent(studentId),
    enabled: enabled && Boolean(studentId),
  });
  const timetable = useQuery({
    queryKey: ['school-sis-timetable-student', studentId],
    queryFn: () => fetchSchoolSisStudentTimetable(studentId),
    enabled: enabled && Boolean(studentId) && tab === 'timetable',
  });
  const fees = useQuery({
    queryKey: ['school-sis-fees-student', studentId],
    queryFn: () => fetchSchoolSisStudentFees(studentId),
    enabled: enabled && Boolean(studentId) && tab === 'fees',
  });

  const photoMut = useMutation({
    mutationFn: (file: File) => uploadSchoolSisStudentPhoto(studentId, file, 'STUDENT'),
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: ['school-sis-student', studentId] });
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const row = student.data;
  const enr = row ? currentEnrollment(row) : undefined;
  const completion = row ? profileCompletion(row) : { percent: 0, missing: [] as string[] };
  const house = row ? houseFromStudent(row) : '';
  const photoSrc = resolveUploadAssetUrl(row?.photoUrl) ?? row?.photoUrl ?? undefined;
  const languages = asList(row?.languagesKnown);
  const allergies = asList(row?.medical?.allergies);
  const transport = row?.transportJson ?? {};
  const hostel = row?.hostelJson ?? {};
  const age = row ? ageFromDob(row.dateOfBirth) : null;

  const badges = useMemo(() => {
    if (!row) return [];
    const list: Array<{ label: string; className: string }> = [];
    if (row.usesTransport) list.push({ label: 'Transport', className: 'bg-sky-50 text-sky-800' });
    if (row.usesHostel) list.push({ label: 'Hostel', className: 'bg-violet-50 text-violet-800' });
    if (row.parentPortalActive)
      list.push({ label: 'Parent Portal', className: 'bg-emerald-50 text-emerald-800' });
    if (allergies.length || row.medical?.medicalConditions || row.medical?.emergencyNotes) {
      list.push({ label: 'Medical Alert', className: 'bg-rose-50 text-rose-800' });
    }
    return list;
  }, [allergies.length, row]);

  if (student.isLoading) {
    return <p className="text-sm text-slate-500">Loading student profile…</p>;
  }
  if (!row) {
    return <p className="text-sm text-red-600">Student not found.</p>;
  }

  const statusLive = row.status === 'ACTIVE';
  const classLabel = enr ? `${enr.section.grade.name} - ${enr.section.name}` : '—';
  const yearLabel = enr?.academicYear.name ?? '—';
  const printProfile = () => {
    document.body.classList.remove('is-printing-id');
    window.print();
  };
  const printIdCard = () => {
    setMoreOpen(false);
    document.body.classList.add('is-printing-id');
    window.print();
    window.setTimeout(() => document.body.classList.remove('is-printing-id'), 500);
  };
  const medicalAlert = Boolean(
    allergies.length || row.medical?.medicalConditions || row.medical?.emergencyNotes,
  );
  const emergencyPhone =
    row.guardians.find((g) => g.guardian.phone)?.guardian.phone || row.phone || '';

  return (
    <div className="sls-student-profile space-y-4">
      <nav className="flex items-center gap-2 text-xs text-slate-400">
        <Link href="/admin/school-sis/students" className="hover:text-[#1a365d]">
          Students
        </Link>
        <span>/</span>
        <span className="font-medium text-slate-600">View Student</span>
      </nav>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section className="sls-profile-hero">
        <div className="flex min-w-0 flex-1 flex-col gap-4 lg:flex-row lg:items-start">
          <div className="relative mx-auto shrink-0 lg:mx-0">
            {photoSrc ? (
              <img
                src={photoSrc}
                alt=""
                className="h-24 w-24 rounded-full object-cover ring-4 ring-sky-50"
              />
            ) : (
              <span className="flex h-24 w-24 items-center justify-center rounded-full bg-sky-100 text-2xl font-semibold text-sky-800 ring-4 ring-sky-50">
                {studentInitials(row.fullName)}
              </span>
            )}
            {canManage ? (
              <>
                <input
                  ref={photoRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) photoMut.mutate(file);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border border-white bg-[#2563eb] text-white shadow"
                  aria-label="Upload photo"
                  onClick={() => photoRef.current?.click()}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </>
            ) : null}
          </div>

          <div className="min-w-0 flex-1 text-center lg:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
              <h1 className="sls-profile-name">{row.fullName}</h1>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                  statusLive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600',
                )}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    statusLive ? 'bg-emerald-500' : 'bg-slate-400',
                  )}
                />
                {row.status.replace(/_/g, ' ')}
              </span>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 xl:grid-cols-6">
              <div>
                <dt className="text-[11px] text-slate-400">Admission No.</dt>
                <dd className="font-mono text-sm font-semibold text-slate-800">
                  {row.admissionNumber}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-slate-400">Roll No.</dt>
                <dd className="font-mono text-sm font-semibold text-slate-800">
                  {enr?.rollNumber || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-slate-400">Class & Section</dt>
                <dd className="text-sm font-semibold text-slate-800">{classLabel}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-slate-400">Academic Year</dt>
                <dd className="text-sm font-semibold text-slate-800">{yearLabel}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-slate-400">House</dt>
                <dd className="text-sm font-semibold text-slate-800">{house || '—'}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-slate-400">Blood Group</dt>
                <dd className="inline-flex items-center gap-1 text-sm font-semibold text-slate-800">
                  {row.bloodGroup ? <Droplets className="h-3.5 w-3.5 text-rose-500" /> : null}
                  {row.bloodGroup || '—'}
                </dd>
              </div>
            </dl>

            {badges.length ? (
              <div className="mt-3 flex flex-wrap justify-center gap-1.5 lg:justify-start">
                {badges.map((b) => (
                  <span
                    key={b.label}
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                      b.className,
                    )}
                  >
                    {b.label}
                  </span>
                ))}
              </div>
            ) : null}

            <button
              type="button"
              className="mt-4 w-full text-left"
              onClick={() => setGapsOpen((v) => !v)}
            >
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Profile completion</span>
                <span className="font-semibold text-[#1a365d]">{completion.percent}%</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-[#2563eb]"
                  style={{ width: `${completion.percent}%` }}
                />
              </div>
            </button>
            {gapsOpen ? (
              <div className="mt-2 rounded-xl border border-amber-100 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
                {completion.missing.length ? (
                  <ul className="list-disc space-y-0.5 pl-4">
                    {completion.missing.map((g) => (
                      <li key={g}>{g}</li>
                    ))}
                  </ul>
                ) : (
                  <p>Required profile fields are complete.</p>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-3 sm:flex-row lg:flex-col">
          <div className="sls-profile-actions flex flex-wrap justify-end gap-2">
            {canManage ? (
              <Link
                href={`/admin/school-sis/students/${row.id}/edit`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563eb] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#1d4ed8]"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit Student
              </Link>
            ) : null}
            <button
              type="button"
              onClick={printProfile}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-sky-200"
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </button>
            <div className="relative">
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-slate-600 hover:border-sky-200"
                aria-label="More actions"
                onClick={() => setMoreOpen((v) => !v)}
              >
                <MoreHorizontal className="h-4 w-4" />
                <ChevronDown className="h-3 w-3" />
              </button>
              {moreOpen ? (
                <div className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                  <button
                    type="button"
                    className="sls-more-item"
                    onClick={() => {
                      setMoreOpen(false);
                      printProfile();
                    }}
                  >
                    <Download className="h-3.5 w-3.5" /> Download profile
                  </button>
                  <button type="button" className="sls-more-item" onClick={printIdCard}>
                    <IdCard className="h-3.5 w-3.5" /> Print ID card
                  </button>
                  <button
                    type="button"
                    className="sls-more-item"
                    onClick={() => {
                      setMoreOpen(false);
                      setTab('documents');
                    }}
                  >
                    <FileText className="h-3.5 w-3.5" /> View documents
                  </button>
                  <button
                    type="button"
                    className="sls-more-item"
                    onClick={() => {
                      setMoreOpen(false);
                      setTab('academics');
                    }}
                  >
                    <History className="h-3.5 w-3.5" /> Enrollment history
                  </button>
                  {canManage ? (
                    <Link
                      href={`/admin/school-sis/students/${row.id}/edit`}
                      className="sls-more-item"
                      onClick={() => setMoreOpen(false)}
                    >
                      <Shield className="h-3.5 w-3.5" /> Change status
                    </Link>
                  ) : null}
                  <p className="sls-more-item sls-more-item-muted">
                    <StickyNote className="h-3.5 w-3.5" /> Archive / withdraw
                    <span>Soon</span>
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <div className="sls-kpi-row sls-profile-print-hide">
        {[
          { label: 'Attendance', value: '—', hint: 'Coming soon', soon: true },
          { label: 'Academics', value: '—', hint: 'Coming soon', soon: true },
          { label: 'Fees', value: '—', hint: 'Coming soon', soon: true },
          { label: 'Library', value: '—', hint: 'Coming soon', soon: true },
          {
            label: 'Transport',
            value: row.usesTransport ? 'Assigned' : 'None',
            hint: row.usesTransport ? 'On file' : 'Not assigned',
            soon: false,
          },
          {
            label: 'Medical',
            value: row.medical ? (medicalAlert ? 'Alert' : 'No alert') : 'Restricted',
            hint: row.medical ? 'From health record' : 'Permission required',
            soon: false,
          },
          {
            label: 'Parent portal',
            value: row.parentPortalActive ? 'Active' : 'Off',
            hint: row.parentPortalActive ? 'Account linked' : 'No portal yet',
            soon: false,
          },
          {
            label: 'Documents',
            value: String(row.documents.length),
            hint: row.documents.length ? 'On file' : 'None uploaded',
            soon: false,
          },
        ].map((kpi) => (
          <div key={kpi.label} className={cn('sls-kpi-card', kpi.soon && 'is-soon')}>
            <p className="value">{kpi.value}</p>
            <p className="label">{kpi.label}</p>
            <p className="hint">{kpi.hint}</p>
          </div>
        ))}
      </div>

      <div className="sls-profile-tabs" role="tablist">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={cn('sls-profile-tab', tab === item.id && 'is-active')}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <div className="space-y-4 xl:col-span-2">
            <Card
              title="Personal Information"
              icon={UserRound}
              action={
                canManage ? (
                  <Link
                    href={`/admin/school-sis/students/${row.id}/edit`}
                    className="text-xs font-semibold text-[#2563eb]"
                  >
                    Edit
                  </Link>
                ) : null
              }
            >
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Full name" value={row.fullName} />
                <Field label="Date of birth" value={formatSchoolDate(row.dateOfBirth)} />
                <Field label="Age" value={age != null ? `${age} years` : '—'} />
                <Field label="Gender" value={row.gender} />
                <Field label="Nationality" value={row.nationality} />
                <Field label="Religion" value={row.religion} />
                <Field label="Blood group" value={row.bloodGroup} />
                <Field label="Aadhaar / National ID" value={row.aadhaarNumber} />
                <Field label="Phone" value={row.phone} />
                <Field label="Email" value={row.email} />
                <Field label="Mother tongue" value={row.motherTongue} />
                <Field
                  label="Emergency contact"
                  value={row.guardians.find((g) => g.guardian.phone)?.guardian.phone}
                />
              </div>
              {languages.length ? (
                <div className="mt-4">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    Languages
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {languages.map((lang) => (
                      <span
                        key={lang}
                        className="rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-800"
                      >
                        {lang}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="mt-4">
                <Field
                  label="Address"
                  value={formatSchoolAddress(row.currentAddress, row.address)}
                />
              </div>
            </Card>

            <Card
              title="Academic Information"
              icon={GraduationCap}
              action={
                canManage ? (
                  <Link
                    href={`/admin/school-sis/students/${row.id}/edit`}
                    className="text-xs font-semibold text-[#2563eb]"
                  >
                    Edit
                  </Link>
                ) : null
              }
            >
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Admission date" value={formatSchoolDate(enr?.admissionDate)} />
                <Field label="Admission number" value={row.admissionNumber} />
                <Field label="Roll number" value={enr?.rollNumber} />
                <Field label="Class" value={enr?.section.grade.name} />
                <Field label="Section" value={enr?.section.name} />
                <Field label="Academic year" value={yearLabel} />
                <Field label="House" value={house} />
                <Field label="Class teacher" value={row.classTeacher?.fullName} />
                <Field label="Enrollment status" value={enr?.status} />
                <Field
                  label="Previous school"
                  value={
                    row.previousSchools[0]
                      ? `${row.previousSchools[0].schoolName}${row.previousSchools[0].lastClass ? ` · ${row.previousSchools[0].lastClass}` : ''}`
                      : '—'
                  }
                />
              </div>
              {(row.subjects ?? []).length ? (
                <div className="mt-4">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    Subjects
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {row.subjects!.map((s) => (
                      <span
                        key={s.id}
                        className="rounded-full bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700"
                      >
                        {s.name}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-400">
                  No subjects mapped for this class yet.
                </p>
              )}
            </Card>

            <Card title="Parent & Guardian" icon={Users}>
              {row.guardians.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {row.guardians.map((link) => {
                    const g = link.guardian;
                    const relation = link.relationship || g.relation;
                    const wa = indianWhatsAppHref(g.phone);
                    return (
                      <div
                        key={g.id}
                        className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3"
                      >
                        {g.photoUrl ? (
                          <img
                            src={resolveUploadAssetUrl(g.photoUrl) ?? g.photoUrl}
                            alt=""
                            className="h-11 w-11 rounded-full object-cover"
                          />
                        ) : (
                          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-xs font-semibold text-sky-800">
                            {studentInitials(g.fullName)}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                            {relation}
                          </p>
                          <p className="truncate text-sm font-semibold text-slate-800">
                            {g.fullName}
                          </p>
                          {g.occupation ? (
                            <p className="text-xs text-slate-500">{g.occupation}</p>
                          ) : null}
                          <div className="mt-2 flex gap-2">
                            {g.phone ? (
                              <a
                                href={`tel:${g.phone}`}
                                className="sls-contact-btn"
                                aria-label="Call"
                              >
                                <Phone className="h-3.5 w-3.5" />
                              </a>
                            ) : null}
                            {wa ? (
                              <a
                                href={wa}
                                target="_blank"
                                rel="noreferrer"
                                className="sls-contact-btn"
                                aria-label="WhatsApp"
                              >
                                <MessageCircle className="h-3.5 w-3.5" />
                              </a>
                            ) : null}
                            {g.email ? (
                              <a
                                href={`mailto:${g.email}`}
                                className="sls-contact-btn"
                                aria-label="Email"
                              >
                                <Mail className="h-3.5 w-3.5" />
                              </a>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No parent or guardian on file.</p>
              )}
              {row.siblingLinks?.length ? (
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    Siblings in school
                  </p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {row.siblingLinks.map((link) => (
                      <li key={link.sibling.id}>
                        <Link
                          href={`/admin/school-sis/students/${link.sibling.id}`}
                          className="font-medium text-[#2563eb] hover:underline"
                        >
                          {link.sibling.fullName}
                        </Link>
                        <span className="text-slate-400">
                          {' '}
                          · {link.sibling.admissionNumber}
                          {link.sibling.enrollments[0]
                            ? ` · ${link.sibling.enrollments[0].section.grade.name} ${link.sibling.enrollments[0].section.name}`
                            : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </Card>
          </div>

          <div className="space-y-4">
            {row.usesTransport ? (
              <Card title="Transport" icon={Bus}>
                <div className="grid gap-3">
                  <Field label="Route" value={transport.routeId || transport.route} />
                  <Field label="Vehicle" value={transport.vehicleId || transport.busNumber} />
                  <Field label="Pickup" value={transport.pickupPoint} />
                  <Field label="Drop" value={transport.dropPoint} />
                </div>
                <p className="mt-3 text-[11px] text-slate-400">
                  Live GPS tracking will appear here when the transport module is enabled.
                </p>
              </Card>
            ) : null}
            {row.usesHostel ? (
              <Card title="Hostel" icon={Home}>
                <div className="grid gap-3">
                  <Field label="Hostel" value={hostel.hostelId || hostel.name} />
                  <Field label="Room" value={hostel.roomNumber} />
                  <Field
                    label="Joined"
                    value={hostel.joinedAt ? formatSchoolDate(hostel.joinedAt) : '—'}
                  />
                </div>
              </Card>
            ) : null}
            {row.medical ? (
              <Card title="Medical record" icon={HeartPulse}>
                <div className="grid gap-3">
                  <Field label="Blood group" value={row.bloodGroup} />
                  <Field label="Allergies" value={allergies.join(', ') || 'None recorded'} />
                  <Field label="Conditions" value={row.medical.medicalConditions} />
                  <Field label="Medications" value={row.medical.medications} />
                  <Field label="Health notes" value={row.medical.medicalHealth} />
                  {row.medical.emergencyNotes ? (
                    <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-800">
                      {row.medical.emergencyNotes}
                    </p>
                  ) : null}
                </div>
              </Card>
            ) : null}
            <Card title="Quick facts" icon={Activity}>
              <div className="space-y-2 text-sm">
                <p className="flex items-center justify-between">
                  <span className="text-slate-500">Documents on file</span>
                  <span className="font-semibold">{row.documents.length}</span>
                </p>
                <p className="flex items-center justify-between">
                  <span className="text-slate-500">Guardians</span>
                  <span className="font-semibold">{row.guardians.length}</span>
                </p>
                <p className="flex items-center justify-between">
                  <span className="text-slate-500">Enrollments</span>
                  <span className="font-semibold">{row.enrollments.length}</span>
                </p>
              </div>
            </Card>
          </div>

          <div className="xl:col-span-3">
            <Card title="Student timeline" icon={History}>
              {row.enrollmentEvents.length ? (
                <ol className="space-y-3">
                  {row.enrollmentEvents.slice(0, 12).map((ev) => (
                    <li key={ev.id} className="flex gap-3 text-sm">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-sky-500" />
                      <div>
                        <p className="font-medium text-slate-800">{ev.type.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-slate-500">
                          {formatSchoolDateTime(ev.createdAt)}
                          {ev.actorName ? ` · ${ev.actorName}` : ''}
                          {ev.note ? ` · ${ev.note}` : ''}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-slate-400">No enrollment events yet.</p>
              )}
            </Card>
          </div>
        </div>
      ) : null}

      {tab === 'academics' ? (
        <div className="space-y-4">
          <Card title="Enrollment history" icon={BookOpen}>
            {row.enrollments.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-[11px] uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-2 py-2">Year</th>
                      <th className="px-2 py-2">Class</th>
                      <th className="px-2 py-2">Section</th>
                      <th className="px-2 py-2">Roll</th>
                      <th className="px-2 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.enrollments.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="px-2 py-2">{item.academicYear.name}</td>
                        <td className="px-2 py-2">{item.section.grade.name}</td>
                        <td className="px-2 py-2">{item.section.name}</td>
                        <td className="px-2 py-2 font-mono text-xs">{item.rollNumber || '—'}</td>
                        <td className="px-2 py-2">{item.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-400">No enrollment records.</p>
            )}
          </Card>
          <Card title="Subjects" icon={GraduationCap}>
            {(row.subjects ?? []).length ? (
              <div className="flex flex-wrap gap-1.5">
                {row.subjects!.map((s) => (
                  <span
                    key={s.id}
                    className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800"
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">
                Subjects will appear when the class curriculum is mapped.
              </p>
            )}
          </Card>
          <ComingSoon
            title="Marks and GPA"
            hint="Academic performance charts will use real examination records once that module is enabled."
          />
        </div>
      ) : null}

      {tab === 'health' ? (
        <Card title="Health" icon={HeartPulse}>
          {row.medical ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Blood group" value={row.bloodGroup} />
              <Field label="Allergies" value={allergies.join(', ') || 'None recorded'} />
              <Field label="Conditions" value={row.medical.medicalConditions} />
              <Field label="Medications" value={row.medical.medications} />
              <Field label="Health notes" value={row.medical.medicalHealth} />
              <Field label="Emergency notes" value={row.medical.emergencyNotes} />
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              You do not have permission to view medical records.
            </p>
          )}
        </Card>
      ) : null}

      {tab === 'documents' ? (
        <Card title="Documents" icon={FileText}>
          {row.documents.length ? (
            <ul className="divide-y divide-slate-100 text-sm">
              {row.documents.map((doc) => (
                <li
                  key={doc.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                >
                  <div>
                    <p className="font-medium text-slate-800">{doc.slot.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-slate-500">
                      {doc.fileName}
                      {doc.createdAt ? ` · ${formatSchoolDate(doc.createdAt)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                      {doc.verificationStatus || 'PENDING'}
                    </span>
                    {doc.hasFile ? (
                      <button
                        type="button"
                        className="text-xs font-semibold text-[#2563eb]"
                        onClick={() =>
                          void fetchSchoolSisStudentDocumentFile(row.id, doc.id, doc.fileName)
                        }
                      >
                        View
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">No documents uploaded yet.</p>
          )}
        </Card>
      ) : null}

      {tab === 'timeline' ? (
        <Card title="Timeline" icon={History}>
          {row.enrollmentEvents.length ? (
            <ol className="space-y-4">
              {row.enrollmentEvents.map((ev) => (
                <li key={ev.id} className="border-l-2 border-sky-100 pl-4">
                  <p className="text-sm font-semibold text-slate-800">
                    {ev.type.replace(/_/g, ' ')}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatSchoolDateTime(ev.createdAt)}
                    {ev.actorName ? ` · ${ev.actorName}` : ''}
                  </p>
                  {ev.note ? <p className="mt-1 text-sm text-slate-600">{ev.note}</p> : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-slate-400">No timeline events.</p>
          )}
        </Card>
      ) : null}

      {tab === 'audit' ? (
        canManage ? (
          <Card title="Audit trail" icon={Shield}>
            {row.auditLogs?.length ? (
              <ul className="space-y-3 text-sm">
                {row.auditLogs.map((log) => (
                  <li key={log.id}>
                    <p className="font-medium text-slate-800">{log.action.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-slate-500">
                      {formatSchoolDateTime(log.createdAt)}
                      {log.actorName ? ` · ${log.actorName}` : ''}
                      {log.entity ? ` · ${log.entity}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">No audit entries yet.</p>
            )}
          </Card>
        ) : (
          <p className="text-sm text-slate-500">Audit trail is limited to school administrators.</p>
        )
      ) : null}

      {tab === 'attendance' ? (
        <ComingSoon
          title="Attendance"
          hint="Daily and monthly attendance will appear here from class registers. No sample percentages are shown."
        />
      ) : null}
      {tab === 'exams' ? (
        <ComingSoon
          title="Exams & results"
          hint="Marks, grades and report cards will load from the examinations module."
        />
      ) : null}
      {tab === 'fees' ? (
        fees.isLoading ? (
          <p className="text-sm text-slate-500">Loading fee structure…</p>
        ) : fees.data?.structure ? (
          <StudentFeeStructures
            enrollmentLabel={`${fees.data.enrollment.grade.name} ${fees.data.enrollment.section.name}`}
            defaultStructure={fees.data.structure}
            structures={fees.data.structures?.length ? fees.data.structures : [fees.data.structure]}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
            <p className="text-sm font-semibold text-[#1a365d]">No class fee structure yet</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
              {fees.error
                ? apiErrorMessage(fees.error)
                : 'No published fee structure for this class in the current academic year.'}
            </p>
          </div>
        )
      ) : null}
      {tab === 'timetable' ? (
        timetable.isLoading ? (
          <p className="text-sm text-slate-500">Loading class timetable…</p>
        ) : timetable.data ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="mb-3 text-sm text-slate-500">
              This student’s timetable is the class timetable for{' '}
              <span className="font-medium text-[#1a365d]">
                {timetable.data.section?.grade.name} {timetable.data.section?.name}
              </span>
              . It is not stored as a separate student schedule.
            </p>
            <SchoolSisTimetableGrid
              grid={timetable.data}
              canEdit={false}
              subjects={[]}
              staff={[]}
              queryKey={['school-sis-timetable-student', studentId]}
              printTitle={`${row?.fullName ?? ''} · ${timetable.data.section?.grade.name ?? ''} ${timetable.data.section?.name ?? ''}`}
              printSub={`Academic Year: ${timetable.data.academicYear.name}`}
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
            <p className="text-sm font-semibold text-[#1a365d]">No class timetable yet</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
              {timetable.error
                ? apiErrorMessage(timetable.error)
                : 'This student needs an active enrollment in a class section. The timetable is then taken from that section.'}
            </p>
          </div>
        )
      ) : null}
      {tab === 'library' ? (
        <ComingSoon
          title="Library"
          hint="Issued books and dues will appear when the school library module is switched on."
        />
      ) : null}
      {tab === 'achievements' ? (
        <ComingSoon
          title="Achievements"
          hint="Academic, sports and cultural awards will be recorded here."
        />
      ) : null}
      {tab === 'discipline' ? (
        <ComingSoon
          title="Discipline"
          hint="Authorized incident records will be listed with strict permissions."
        />
      ) : null}
      {tab === 'communication' ? (
        <ComingSoon
          title="Communication"
          hint="Notices, SMS and messages to this family will be collected here."
        />
      ) : null}
      {tab === 'notices' ? (
        <ComingSoon
          title="Notices"
          hint="School notices relevant to this student will show when broadcasting is live."
        />
      ) : null}

      <article className="sls-id-card">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <img src={SCHOOL_SIS_LOGO_SRC} alt="" className="h-10 w-10 object-contain" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#1a365d]">
              St. Luke&apos;s Secondary School
            </p>
            <p className="text-[10px] text-slate-500">
              Tura, Meghalaya · Knowledge · Service · Light
            </p>
          </div>
        </div>
        <div className="mt-3 flex gap-3">
          {photoSrc ? (
            <img src={photoSrc} alt="" className="h-24 w-20 rounded-lg object-cover" />
          ) : (
            <div className="flex h-24 w-20 items-center justify-center rounded-lg bg-sky-100 text-lg font-bold text-sky-800">
              {studentInitials(row.fullName)}
            </div>
          )}
          <div className="min-w-0 text-xs">
            <p className="text-sm font-bold uppercase leading-tight text-[#0f172a]">
              {row.fullName}
            </p>
            <p className="mt-2">
              <span className="text-slate-400">Admission No.</span> {row.admissionNumber}
            </p>
            <p>
              <span className="text-slate-400">Roll No.</span> {enr?.rollNumber || '—'}
            </p>
            <p>
              <span className="text-slate-400">Class</span> {classLabel}
            </p>
            <p>
              <span className="text-slate-400">Year</span> {yearLabel}
            </p>
            {emergencyPhone ? (
              <p>
                <span className="text-slate-400">Emergency</span> {emergencyPhone}
              </p>
            ) : null}
          </div>
        </div>
      </article>

      <p className="flex items-center justify-center gap-2 pt-2 text-[11px] text-slate-400 sls-profile-print-hide">
        <img src={SCHOOL_SIS_LOGO_SRC} alt="" className="h-6 w-6 object-contain" />
        St. Luke&apos;s Secondary School, Tura · Knowledge · Service · Light
      </p>
    </div>
  );
}

function StudentFeeStructures({
  enrollmentLabel,
  defaultStructure,
  structures,
}: {
  enrollmentLabel: string;
  defaultStructure: SchoolSisFeeStructure;
  structures: SchoolSisFeeStructure[];
}) {
  const [id, setId] = useState(defaultStructure.id);
  const current = structures.find((s) => s.id === id) ?? defaultStructure;
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        Class fee structure for{' '}
        <span className="font-medium text-[#1a365d]">{enrollmentLabel}</span>. Individual ledgers
        and receipts are not opened yet.
      </p>
      {structures.length > 1 ? (
        <label className="block text-sm">
          <span className="text-slate-500">Admission type</span>
          <select
            className="mt-1 w-full max-w-xl rounded-xl border border-slate-200 bg-white px-3 py-2"
            value={current.id}
            onChange={(e) => setId(e.target.value)}
          >
            {structures.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · ₹{s.totals.printedGrandTotal.toLocaleString('en-IN')}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <SchoolSisFeeStructureCard structure={current} />
    </div>
  );
}

'use client';

import Image from 'next/image';
import { IndianRupee, Mail, Phone, Home } from 'lucide-react';
import { AdmitEligibilityCard } from '@/components/principal-desk/admit-eligibility-card';
import { AttendanceMeter } from '@/components/principal-desk/attendance-meter';
import { FeeMonthGrid } from '@/components/principal-desk/fee-month-grid';
import { SaaSCard, SectionTitle, money } from '@/components/dashboard/command-center-ui';
import type { StudentCommandCard } from '@/types/principal-desk';

export function StudentCommandCardView({ data }: { data: StudentCommandCard }) {
  const tracker = (data.fees.monthlyTracker ?? []) as Array<{
    month: string;
    status: string;
    amount?: number;
  }>;

  return (
    <div className="space-y-4">
      <SaaSCard className="overflow-hidden border-indigo-200/60 bg-gradient-to-br from-white to-indigo-50/30">
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <div className="relative mx-auto h-28 w-28 shrink-0 overflow-hidden rounded-2xl border-2 border-white shadow-lg md:mx-0">
            {data.basic.photoUrl ? (
              <Image
                src={data.basic.photoUrl}
                alt={data.basic.fullName}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-slate-100 text-3xl font-bold text-slate-400">
                {data.basic.fullName.charAt(0)}
              </div>
            )}
          </div>
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-2xl font-black text-slate-900">{data.basic.fullName}</h2>
            <p className="text-sm font-medium text-indigo-600">
              {data.academic.programme} · Semester {data.academic.semester ?? '—'}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-emerald-600">
              {data.academic.statusLabel}
            </p>
            <div className="mt-3 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
              <span>
                Enrollment: <strong>{data.basic.enrollmentNumber}</strong>
              </span>
              <span>
                Roll: <strong>{data.basic.rollNumber ?? '—'}</strong>
              </span>
              <span>
                ABC ID: <strong>{data.basic.abcId ?? '—'}</strong>
              </span>
              <span>
                RFID: <strong>{data.basic.rfidNumber ?? '—'}</strong>
              </span>
              <span className="flex items-center justify-center gap-1 md:justify-start">
                <Phone className="h-3 w-3" /> {data.basic.mobile ?? '—'}
              </span>
              <span className="flex items-center justify-center gap-1 md:justify-start">
                <Mail className="h-3 w-3" /> {data.basic.email ?? '—'}
              </span>
            </div>
          </div>
          <div className="shrink-0">
            <AttendanceMeter
              percentage={data.attendance.percentage}
              band={data.attendance.band}
              classesAttended={data.attendance.classesAttended}
              classesConducted={data.attendance.classesConducted}
            />
          </div>
        </div>
      </SaaSCard>

      <AdmitEligibilityCard
        eligible={data.admitCard.eligible}
        reasons={data.admitCard.reasons}
        attendancePercent={data.admitCard.attendancePercent}
        outstandingAmount={data.admitCard.outstandingAmount}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <SaaSCard>
          <SectionTitle title="Fee Information" />
          <div className="mb-3 flex items-center gap-2 text-sm">
            <IndianRupee className="h-4 w-4 text-amber-600" />
            <span>
              Outstanding:{' '}
              <strong className="text-rose-600">{money(data.fees.outstandingAmount)}</strong>
            </span>
          </div>
          <FeeMonthGrid tracker={tracker} />
        </SaaSCard>

        <SaaSCard>
          <SectionTitle title="Library Status" />
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-slate-500">Books Issued</p>
              <p className="text-xl font-bold">{data.library.booksIssued}</p>
            </div>
            <div>
              <p className="text-slate-500">Currently Held</p>
              <p className="text-xl font-bold">{data.library.booksCurrentlyHeld}</p>
            </div>
            <div>
              <p className="text-slate-500">Due Books</p>
              <p className="text-xl font-bold text-amber-600">{data.library.dueBooks}</p>
            </div>
            <div>
              <p className="text-slate-500">Fine Due</p>
              <p className="text-xl font-bold text-rose-600">{money(data.library.fineAmount)}</p>
            </div>
          </div>
        </SaaSCard>

        <SaaSCard>
          <SectionTitle title="Examination" />
          <div className="space-y-2 text-sm">
            <p>
              Internal marks recorded: <strong>{data.examination.internalMarksRecorded}</strong>
            </p>
            <p>
              Backlogs: <strong>{data.examination.backlogs}</strong>
            </p>
            <p>
              Eligibility:{' '}
              <strong
                className={
                  data.examination.examinationEligible ? 'text-emerald-600' : 'text-rose-600'
                }
              >
                {data.examination.examinationEligible ? 'Eligible' : 'Review required'}
              </strong>
            </p>
          </div>
        </SaaSCard>

        <SaaSCard>
          <SectionTitle title="Disciplinary & Counselling" />
          {data.disciplinary.length === 0 ? (
            <p className="text-sm text-slate-500">No records</p>
          ) : (
            <ul className="space-y-2">
              {data.disciplinary.map((r) => (
                <li
                  key={r.id}
                  className="rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2 text-sm"
                >
                  <span className="font-semibold text-amber-800">{r.type}</span>
                  <p className="text-slate-700">{r.body}</p>
                </li>
              ))}
            </ul>
          )}
        </SaaSCard>

        {data.hostel.isHosteller && (
          <SaaSCard>
            <SectionTitle title="Hostel" />
            <div className="flex items-center gap-2 text-sm">
              <Home className="h-4 w-4" />
              <span>
                Block <strong>{data.hostel.block ?? '—'}</strong> · Room{' '}
                <strong>{data.hostel.room ?? '—'}</strong>
              </span>
            </div>
          </SaaSCard>
        )}
      </div>

      <SaaSCard>
        <SectionTitle title="Student Timeline" />
        {data.timeline.length === 0 ? (
          <p className="text-sm text-slate-500">No recent activity</p>
        ) : (
          <ul className="space-y-2">
            {data.timeline.map((e, i) => (
              <li key={`${e.at}-${i}`} className="flex items-center gap-3 text-sm">
                <span className="w-20 shrink-0 text-xs font-semibold text-indigo-600">
                  {e.dayLabel}
                </span>
                <span className="text-slate-700">{e.label}</span>
              </li>
            ))}
          </ul>
        )}
      </SaaSCard>
    </div>
  );
}

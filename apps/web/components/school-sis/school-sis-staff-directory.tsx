'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, UserPlus, Users } from 'lucide-react';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { canManageSchoolSis } from '@/lib/school-sis/permissions';
import { formatSchoolDate } from '@/lib/school-sis/student-profile';
import { staffInitials, staffProfileCompletion } from '@/lib/school-sis/staff-profile';
import { fetchSchoolSisStaff, type SchoolSisStaff } from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

function typeLabel(v: string) {
  return v === 'NON_TEACHING' ? 'Non-teaching' : 'Teaching';
}

export function SchoolSisStaffDirectory() {
  const enabled = useAuthQueryEnabled();
  const user = useAuthStore((s) => s.session?.user);
  const canManage = canManageSchoolSis(user?.permissions);
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [incompleteOnly, setIncompleteOnly] = useState(false);

  const staff = useQuery({
    queryKey: ['school-sis-staff'],
    queryFn: fetchSchoolSisStaff,
    enabled,
  });

  const rows = staff.data ?? [];
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((s) => {
      if (type && s.staffType !== type) return false;
      const pct = staffProfileCompletion(s).percent;
      if (incompleteOnly && pct >= 70) return false;
      if (!needle) return true;
      const blob = [
        s.fullName,
        s.employeeCode,
        s.designation,
        s.classAssigned,
        s.phone,
        s.email,
        s.academicQualification,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return blob.includes(needle);
    });
  }, [rows, q, type, incompleteOnly]);

  const stats = useMemo(() => {
    const teaching = rows.filter((s) => s.staffType === 'TEACHING').length;
    const incomplete = rows.filter((s) => staffProfileCompletion(s).percent < 70).length;
    return { total: rows.length, teaching, nonTeaching: rows.length - teaching, incomplete };
  }, [rows]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#1a365d]">Staff</h1>
          <p className="mt-1 text-sm text-slate-500">
            Teaching register imported from the school list. Blank fields stay blank until the
            office fills them.
          </p>
        </div>
        {canManage ? (
          <Link
            href="/admin/school-sis/staff/new"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#2563eb] px-4 text-sm font-semibold text-white"
          >
            <UserPlus className="h-4 w-4" />
            Add staff
          </Link>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'All staff', value: stats.total, hint: 'School SIS records only' },
          { label: 'Teaching', value: stats.teaching, hint: 'From the teaching register' },
          {
            label: 'Non-teaching',
            value: stats.nonTeaching,
            hint: 'Add when records are available',
          },
          {
            label: 'Incomplete profiles',
            value: stats.incomplete,
            hint: 'Below 70% basic details',
          },
        ].map((card) => (
          <button
            key={card.label}
            type="button"
            className="rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
            onClick={() => {
              if (card.label === 'Incomplete profiles') setIncompleteOnly(true);
              if (card.label === 'Teaching') setType('TEACHING');
              if (card.label === 'Non-teaching') setType('NON_TEACHING');
              if (card.label === 'All staff') {
                setType('');
                setIncompleteOnly(false);
              }
            }}
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
              <Users className="h-4 w-4" />
            </span>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {card.label}
            </p>
            <p className="mt-1 text-2xl font-semibold text-[#1a365d]">
              {staff.isLoading ? '—' : card.value}
            </p>
            <p className="mt-1 text-xs text-slate-400">{card.hint}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, staff ID, class, or qualification…"
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/80 pl-9 pr-3 text-sm outline-none focus:border-sky-300 focus:bg-white"
          />
        </div>
        <select
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="">All types</option>
          <option value="TEACHING">Teaching</option>
          <option value="NON_TEACHING">Non-teaching</option>
        </select>
        <label className="inline-flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={incompleteOnly}
            onChange={(e) => setIncompleteOnly(e.target.checked)}
          />
          Incomplete only
        </label>
      </div>

      {staff.isError ? (
        <p className="text-sm text-red-600">{apiErrorMessage(staff.error)}</p>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#f4f8fc] text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3">Staff</th>
                <th className="px-3 py-3">Staff ID</th>
                <th className="px-3 py-3">Designation</th>
                <th className="px-3 py-3">Class assigned</th>
                <th className="px-3 py-3">Appointment</th>
                <th className="px-3 py-3">Training</th>
                <th className="px-3 py-3">Profile</th>
                <th className="px-3 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {staff.isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    Loading staff…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    No staff match this filter.
                  </td>
                </tr>
              ) : (
                filtered.map((s) => <StaffRow key={s.id} staff={s} />)
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StaffRow({ staff }: { staff: SchoolSisStaff }) {
  const pct = staffProfileCompletion(staff).percent;
  return (
    <tr className="border-t border-slate-100 odd:bg-white even:bg-slate-50/60 hover:bg-sky-50/50">
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          {staff.photoUrl ? (
            <img src={staff.photoUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-100 text-[11px] font-semibold text-sky-800">
              {staffInitials(staff.fullName)}
            </span>
          )}
          <div>
            <Link
              href={`/admin/school-sis/staff/${staff.id}`}
              className="font-semibold text-[#1a365d] hover:underline"
            >
              {staff.fullName}
            </Link>
            <p className="text-xs text-slate-400">{typeLabel(staff.staffType)}</p>
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5 font-mono text-xs">{staff.employeeCode}</td>
      <td className="px-3 py-2.5">{staff.designation || '—'}</td>
      <td className="px-3 py-2.5">{staff.classAssigned || '—'}</td>
      <td className="px-3 py-2.5">{formatSchoolDate(staff.joiningDate)}</td>
      <td className="px-3 py-2.5">{staff.trainingStatus || '—'}</td>
      <td className="px-3 py-2.5">
        <span
          className={cn(
            'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold',
            pct < 70 ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800',
          )}
        >
          {pct}%
        </span>
      </td>
      <td className="px-3 py-2.5">{staff.status || 'ACTIVE'}</td>
    </tr>
  );
}

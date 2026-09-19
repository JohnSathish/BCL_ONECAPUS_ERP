'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  FileWarning,
  GraduationCap,
  MoreHorizontal,
  Search,
  UserPlus,
  Users,
} from 'lucide-react';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { canManageSchoolSis } from '@/lib/school-sis/permissions';
import { formatSchoolDate } from '@/lib/school-sis/student-profile';
import { staffInitials, staffProfileCompletion } from '@/lib/school-sis/staff-profile';
import { fetchSchoolSisStaff, type SchoolSisStaff } from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';
import { SlsCta, SlsKpiCard, SlsPill, SlsToolbar } from '@/components/school-sis/school-sis-saas';

const PAGE_SIZES = [10, 25, 50];

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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const start = filtered.length ? (safePage - 1) * pageSize + 1 : 0;
  const end = Math.min(safePage * pageSize, filtered.length);
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter((n) => {
    if (totalPages <= 7) return true;
    return n === 1 || n === totalPages || Math.abs(n - safePage) <= 1;
  });

  const resetPage = () => setPage(1);

  return (
    <div className="sls-page space-y-5">
      <div className="sls-page-head">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--heading,#1a365d)]">
            Staff
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Teaching register imported from the school list. Blank fields stay blank until the
            office fills them.
          </p>
        </div>
        {canManage ? (
          <SlsCta href="/admin/school-sis/staff/new">
            <UserPlus className="h-4 w-4" />
            Add staff
          </SlsCta>
        ) : null}
      </div>

      <div className="sls-stat-grid is-4">
        <SlsKpiCard
          tone="sky"
          icon={Users}
          label="All staff"
          value={stats.total}
          hint="School SIS records only"
          loading={staff.isLoading}
          onClick={() => {
            setType('');
            setIncompleteOnly(false);
            resetPage();
          }}
        />
        <SlsKpiCard
          tone="emerald"
          icon={GraduationCap}
          label="Teaching"
          value={stats.teaching}
          hint="From the teaching register"
          loading={staff.isLoading}
          onClick={() => {
            setType('TEACHING');
            resetPage();
          }}
        />
        <SlsKpiCard
          tone="amber"
          icon={Users}
          label="Non-teaching"
          value={stats.nonTeaching}
          hint="Add when records are available"
          loading={staff.isLoading}
          onClick={() => {
            setType('NON_TEACHING');
            resetPage();
          }}
        />
        <SlsKpiCard
          tone="rose"
          icon={FileWarning}
          label="Incomplete profiles"
          value={stats.incomplete}
          hint="Below 70% basic details"
          loading={staff.isLoading}
          onClick={() => {
            setIncompleteOnly(true);
            resetPage();
          }}
        />
      </div>

      <SlsToolbar>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              resetPage();
            }}
            placeholder="Search name, staff ID, class, or qualification…"
          />
        </div>
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            resetPage();
          }}
        >
          <option value="">All types</option>
          <option value="TEACHING">Teaching</option>
          <option value="NON_TEACHING">Non-teaching</option>
        </select>
        <label>
          <input
            type="checkbox"
            checked={incompleteOnly}
            onChange={(e) => {
              setIncompleteOnly(e.target.checked);
              resetPage();
            }}
          />
          Incomplete only
        </label>
      </SlsToolbar>

      {staff.isError ? (
        <p className="text-sm text-red-600">{apiErrorMessage(staff.error)}</p>
      ) : null}

      <div className="sls-saas-panel">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Staff</th>
                <th className="px-4 py-3">Staff ID</th>
                <th className="px-4 py-3">Designation</th>
                <th className="px-4 py-3">Class assigned</th>
                <th className="px-4 py-3">Appointment</th>
                <th className="px-4 py-3">Training</th>
                <th className="px-4 py-3">Profile</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                    Loading staff…
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                    No staff match this filter.
                  </td>
                </tr>
              ) : (
                pageRows.map((s) => <StaffRow key={s.id} staff={s} />)
              )}
            </tbody>
          </table>
        </div>
        <div className="sls-saas-foot">
          <p>
            Showing {start} to {end} of {filtered.length} staff
          </p>
          <div className="flex items-center gap-3">
            <div className="sls-saas-pager">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
              >
                <ChevronLeft className="mx-auto h-4 w-4" />
              </button>
              {pages.map((n, i) => {
                const prev = pages[i - 1];
                return (
                  <span key={`${n}-${i}`} className="inline-flex items-center gap-0.5">
                    {prev && n - prev > 1 ? <span className="px-1">…</span> : null}
                    <button
                      type="button"
                      className={n === safePage ? 'is-on' : undefined}
                      onClick={() => setPage(n)}
                    >
                      {n}
                    </button>
                  </span>
                );
              })}
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next page"
              >
                <ChevronRight className="mx-auto h-4 w-4" />
              </button>
            </div>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

function StaffRow({ staff }: { staff: SchoolSisStaff }) {
  const pct = staffProfileCompletion(staff).percent;
  const active = (staff.status || 'ACTIVE').toUpperCase() === 'ACTIVE';
  return (
    <tr>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          {staff.photoUrl ? (
            <img src={staff.photoUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 text-[11px] font-semibold text-sky-800">
              {staffInitials(staff.fullName)}
            </span>
          )}
          <div>
            <Link href={`/admin/school-sis/staff/${staff.id}`}>{staff.fullName}</Link>
            <p className="text-xs text-slate-400">{typeLabel(staff.staffType)}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-slate-500">{staff.employeeCode}</td>
      <td className="px-4 py-3">{staff.designation || '—'}</td>
      <td className="px-4 py-3">{staff.classAssigned || '—'}</td>
      <td className="px-4 py-3">{formatSchoolDate(staff.joiningDate)}</td>
      <td className="px-4 py-3 text-slate-500">{staff.trainingStatus || '—'}</td>
      <td className="px-4 py-3">
        <SlsPill tone={pct < 70 ? 'amber' : 'ok'}>{pct}%</SlsPill>
      </td>
      <td className="px-4 py-3">
        <SlsPill tone={active ? 'ok' : 'muted'}>{staff.status || 'ACTIVE'}</SlsPill>
      </td>
      <td className="px-4 py-3 text-right">
        <Link
          href={`/admin/school-sis/staff/${staff.id}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label={`Open ${staff.fullName}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Link>
      </td>
    </tr>
  );
}

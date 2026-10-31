'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchOpacInfo } from '@/services/opac';

type Info = {
  collegeName: string;
  address: string | null;
  settings: {
    hours: Array<{ label: string; hours: string }>;
    announcements: Array<{ text: string }>;
    contactPhone: string;
    contactEmail: string;
    reservationDays: number;
    maxReservations: number;
  };
  rules: {
    studentLoanDays: number;
    studentMaxBooks: number;
    studentRenewals: number;
    facultyLoanDays: number;
    facultyMaxBooks: number;
    facultyRenewals: number;
    staffLoanDays: number;
    staffMaxBooks: number;
    staffRenewals: number;
    finePerDay: number;
    graceDays: number;
    workingDayLoans?: boolean;
    maxFine: number;
    referenceIssue: boolean;
    rareIssue: boolean;
    reservationDays: number;
    maxReservations: number;
  };
};

export function OpacInfo() {
  const info = useQuery({
    queryKey: ['opac', 'info'],
    queryFn: () => fetchOpacInfo() as Promise<Info>,
  });
  if (info.isLoading) return <p className="text-sm text-slate-500">Loading library information…</p>;
  if (info.isError || !info.data)
    return <p className="text-sm text-red-700">Library information could not be loaded.</p>;
  const rules = info.data.rules;
  const period = rules.workingDayLoans === false ? 'days' : 'working days';
  const rows = [
    [
      'Students',
      `${rules.studentMaxBooks} books`,
      `${rules.studentLoanDays} ${period}`,
      `${rules.studentRenewals} renewals`,
    ],
    [
      'Faculty',
      `${rules.facultyMaxBooks} books`,
      `${rules.facultyLoanDays} ${period}`,
      `${rules.facultyRenewals} renewals`,
    ],
    [
      'Staff',
      `${rules.staffMaxBooks} books`,
      `${rules.staffLoanDays} ${period}`,
      `${rules.staffRenewals} renewals`,
    ],
  ];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Library information</h1>
      <p className="text-sm text-slate-600">
        Loan periods, fines, and reservation limits come from Library Settings. A reference or
        non-circulating copy cannot be issued or reserved.
      </p>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Member</th>
              <th className="px-3 py-2">Limit</th>
              <th className="px-3 py-2">Loan period</th>
              <th className="px-3 py-2">Renewal</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row[0]} className="border-t border-slate-100">
                {row.map((cell) => (
                  <td key={cell} className="px-3 py-2">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
          <h2 className="font-semibold">Fines</h2>
          <p className="mt-2">
            ₹{rules.finePerDay} per{' '}
            {rules.workingDayLoans === false ? 'day' : 'overdue working day'} after{' '}
            {rules.graceDays} grace days.
          </p>
          <p>Maximum fine on one loan: ₹{rules.maxFine}.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
          <h2 className="font-semibold">Reservations</h2>
          <p className="mt-2">Up to {rules.maxReservations} active reservations.</p>
          <p>An unused reservation expires after {rules.reservationDays} days.</p>
          <p className="mt-2 text-slate-600">
            Reference issue is{' '}
            {rules.referenceIssue ? 'allowed by the current category rule' : 'not allowed'}. Rare
            issue is {rules.rareIssue ? 'allowed by the current category rule' : 'not allowed'}.
            Each physical copy can still have its own issue permission.
          </p>
        </div>
      </div>
      {info.data.settings.hours.length ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
          <h2 className="font-semibold">Hours</h2>
          <ul className="mt-2 space-y-1">
            {info.data.settings.hours.map((row) => (
              <li key={row.label}>
                {row.label}: {row.hours}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
        <h2 className="font-semibold">Contact</h2>
        <p className="mt-2">{info.data.collegeName}</p>
        {info.data.address ? <p>{info.data.address}</p> : null}
        {info.data.settings.contactPhone ? <p>{info.data.settings.contactPhone}</p> : null}
        {info.data.settings.contactEmail ? <p>{info.data.settings.contactEmail}</p> : null}
        {!info.data.address &&
        !info.data.settings.contactPhone &&
        !info.data.settings.contactEmail ? (
          <p className="text-slate-500">The librarian has not published a public contact yet.</p>
        ) : null}
      </div>
    </div>
  );
}

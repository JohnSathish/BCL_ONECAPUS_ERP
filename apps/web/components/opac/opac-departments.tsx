'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { fetchOpacDepartments } from '@/services/opac';

export function OpacDepartments() {
  const list = useQuery({ queryKey: ['opac', 'departments'], queryFn: fetchOpacDepartments });
  if (list.isLoading) return <p className="text-sm text-slate-500">Loading departments…</p>;
  if (list.isError) return <p className="text-sm text-red-700">Departments could not be loaded.</p>;
  if (!list.data?.length) {
    return <p className="text-sm text-slate-500">No titles are linked to a department yet.</p>;
  }
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">Departments</h1>
      <ul className="grid gap-3 sm:grid-cols-2">
        {list.data.map((row) => (
          <li key={row.id}>
            <Link
              href={`/opac/search?departmentId=${row.id}`}
              className="block rounded-2xl border border-slate-200 bg-white p-4"
            >
              <p className="font-semibold">{row.name}</p>
              <p className="text-sm text-slate-500">
                {Number(row.titles).toLocaleString('en-IN')} titles
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

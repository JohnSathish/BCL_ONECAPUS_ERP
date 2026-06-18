'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, User } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchLibraryMemberDetail, fetchLibraryMembers } from '@/services/library';

export function LibraryMembersWorkspace() {
  const enabled = useAuthQueryEnabled();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [memberType, setMemberType] = useState<string>('');
  const [selected, setSelected] = useState<{ id: string; type: string } | null>(null);

  const members = useQuery({
    queryKey: ['library', 'members', query, memberType],
    queryFn: () =>
      fetchLibraryMembers({
        search: query || undefined,
        memberType: memberType || undefined,
        limit: 50,
      }),
    enabled,
  });

  const detail = useQuery({
    queryKey: ['library', 'members', selected?.id, selected?.type],
    queryFn: () => fetchLibraryMemberDetail(selected!.id, selected!.type),
    enabled: enabled && Boolean(selected),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Library Members</h1>
        <p className="text-sm text-muted-foreground">
          Active readers with loans, visits, fines, and reading scores
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search name, enrollment, department…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setQuery(search.trim());
            }}
          />
        </div>
        <Button onClick={() => setQuery(search.trim())}>Search</Button>
        <Button
          variant={memberType === 'STUDENT' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMemberType(memberType === 'STUDENT' ? '' : 'STUDENT')}
        >
          Students
        </Button>
        <Button
          variant={memberType === 'STAFF' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMemberType(memberType === 'STAFF' ? '' : 'STAFF')}
        >
          Staff
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border lg:col-span-2">
          <div className="border-b px-4 py-2 text-sm text-muted-foreground">
            {members.data?.total ?? 0} members
          </div>
          <div className="max-h-[32rem] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/80">
                <tr>
                  <th className="p-2 text-left">Member</th>
                  <th className="p-2 text-left">Dept</th>
                  <th className="p-2 text-right">Loans</th>
                  <th className="p-2 text-right">Visits</th>
                  <th className="p-2 text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {members.data?.items.map((m) => (
                  <tr
                    key={`${m.memberType}:${m.memberId}`}
                    className={`cursor-pointer border-t hover:bg-muted/40 ${
                      selected?.id === m.memberId ? 'bg-primary/5' : ''
                    }`}
                    onClick={() => setSelected({ id: m.memberId, type: m.memberType })}
                  >
                    <td className="p-2">
                      <p className="font-medium">{m.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.registrationNumber ?? m.memberType}
                      </p>
                    </td>
                    <td className="p-2">{m.department ?? '—'}</td>
                    <td className="p-2 text-right">{m.loanCount}</td>
                    <td className="p-2 text-right">{m.visitCount}</td>
                    <td className="p-2 text-right">{m.readingScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!members.data?.items.length ? (
              <p className="p-8 text-center text-sm text-muted-foreground">No members found</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          {selected && detail.data ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                  <User className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-semibold">{detail.data.profile?.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {detail.data.profile?.registrationNumber} · {detail.data.profile?.memberType}
                  </p>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">Active loans</dt>
                  <dd className="font-medium">{detail.data.stats.activeLoans}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Total loans</dt>
                  <dd className="font-medium">{detail.data.stats.loanCount}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Visits</dt>
                  <dd className="font-medium">{detail.data.stats.visitCount}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Fine due</dt>
                  <dd className="font-medium">₹{detail.data.stats.outstandingFine.toFixed(0)}</dd>
                </div>
              </dl>
              <div>
                <p className="mb-2 text-sm font-medium">Recent loans</p>
                <ul className="space-y-1 text-xs">
                  {detail.data.recentLoans.slice(0, 5).map((l) => (
                    <li key={l.id} className="rounded border px-2 py-1">
                      {l.title} · {l.status}
                    </li>
                  ))}
                  {!detail.data.recentLoans.length ? (
                    <li className="text-muted-foreground">No loans</li>
                  ) : null}
                </ul>
              </div>
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Select a member to view profile
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  AlertTriangle,
  Download,
  History,
  RefreshCw,
  Search,
  UserCheck,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { fetchStaff } from '@/services/staff';
import {
  createGovernanceMember,
  deactivateGovernanceMember,
  downloadGovernanceImportTemplate,
  fetchCommitteeComposition,
  fetchCommitteeMemberHistory,
  fetchGovernanceCommittees,
  fetchGovernanceConstants,
  fetchGovernanceMemberStats,
  fetchGovernanceMembers,
  replaceGovernanceMember,
  updateGovernanceMember,
} from '@/services/governance';
import type { GovernanceCommitteeMember } from '@/types/governance';
import type { StaffListItem } from '@/types/staff';
import { formatDisplayDate } from '@/utils/format-date';
import { cn } from '@/utils/cn';
import { apiErrorMessage } from '@/utils/api-error';
import {
  CommitteeMemberAddPanel,
  MEMBER_TYPE_OPTIONS,
  buildCreateMemberPayload,
  defaultAddMemberForm,
  isAddFormValid,
  type AddMemberFormState,
} from '@/components/governance-module/committee-member-add-panel';

const ROLE_LABELS: Record<string, string> = {
  CHAIRPERSON: 'Chairperson',
  CONVENER: 'Convenor',
  SECRETARY: 'Secretary',
  MEMBER: 'Member',
  MEMBER_SECRETARY: 'Member Secretary',
  COORDINATOR: 'Coordinator',
  EX_OFFICIO: 'Ex-Officio Member',
  STUDENT_REPRESENTATIVE: 'Student Member',
  EXTERNAL_EXPERT: 'External Member',
  PARENT_REPRESENTATIVE: 'Parent Member',
  ALUMNI_REPRESENTATIVE: 'Alumni Member',
  INDUSTRY_EXPERT: 'Industry Expert',
  LEGAL_EXPERT: 'Legal Expert',
  SPECIAL_INVITEE: 'Special Invitee',
  OBSERVER: 'Observer',
};

const MEMBER_TYPE_LABELS = Object.fromEntries(
  MEMBER_TYPE_OPTIONS.map((o) => [o.value, o.label]),
) as Record<string, string>;

const SELECT_CLASS = 'mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm';

function roleLabel(role: string) {
  return ROLE_LABELS[role] ?? role.replace(/_/g, ' ');
}

function memberTypeLabel(type?: string | null, isExternal?: boolean) {
  if (type && MEMBER_TYPE_LABELS[type]) return MEMBER_TYPE_LABELS[type];
  if (isExternal) return 'External Member';
  return 'Internal Staff';
}

function StaffSearchPicker({
  value,
  onSelect,
  placeholder = 'Search staff by name or employee code',
}: {
  value: StaffListItem | null;
  onSelect: (staff: StaffListItem | null) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value?.fullName ?? '');
  const debounced = useDebouncedValue(query, 300);

  const searchQ = useQuery({
    queryKey: ['staff', 'committee-search', debounced],
    queryFn: () => fetchStaff({ search: debounced, limit: 10, status: 'ACTIVE' }),
    enabled: open && debounced.trim().length >= 2,
  });

  const results = searchQ.data?.data ?? [];

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (!e.target.value.trim()) onSelect(null);
          }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && debounced.trim().length >= 2 ? (
        <div className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover shadow-lg">
          {results.map((staff) => (
            <button
              key={staff.id}
              type="button"
              className="flex w-full flex-col items-start border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted/60"
              onClick={() => {
                onSelect(staff);
                setQuery(staff.fullName);
                setOpen(false);
              }}
            >
              <span className="font-medium">
                {staff.employeeCode} | {staff.fullName}
                {staff.department ? ` | ${staff.department}` : ''}
              </span>
              {staff.designation ? (
                <span className="text-xs text-muted-foreground">{staff.designation}</span>
              ) : null}
            </button>
          ))}
          {!searchQ.isLoading && !results.length ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">No staff found.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function StaffInfoPanel({ staff }: { staff: StaffListItem }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Staff information (read-only)
      </p>
      <dl className="grid gap-2 sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Name</dt>
          <dd className="font-medium">{staff.fullName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Employee code</dt>
          <dd className="font-mono font-medium">{staff.employeeCode}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Department</dt>
          <dd>{staff.department ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Designation</dt>
          <dd>{staff.designation ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Mobile</dt>
          <dd>{staff.mobile ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Email</dt>
          <dd className="truncate">{staff.email ?? '—'}</dd>
        </div>
      </dl>
    </div>
  );
}

export function CommitteeMembersWorkspace() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [filterCommittee, setFilterCommittee] = useState('');
  const [filterQ, setFilterQ] = useState('');

  const [committeeId, setCommitteeId] = useState('');
  const [addForm, setAddForm] = useState<AddMemberFormState>(defaultAddMemberForm());

  const [viewMember, setViewMember] = useState<GovernanceCommitteeMember | null>(null);
  const [editMember, setEditMember] = useState<GovernanceCommitteeMember | null>(null);
  const [replaceMember, setReplaceMember] = useState<GovernanceCommitteeMember | null>(null);
  const [historyCommitteeId, setHistoryCommitteeId] = useState<string | null>(null);
  const [replaceStaff, setReplaceStaff] = useState<StaffListItem | null>(null);
  const [replaceRole, setReplaceRole] = useState('MEMBER');

  const statsQ = useQuery({
    queryKey: ['governance', 'member-stats'],
    queryFn: fetchGovernanceMemberStats,
    enabled,
  });
  const committeesQ = useQuery({
    queryKey: ['governance', 'committees'],
    queryFn: () => fetchGovernanceCommittees({ limit: 200 }),
    enabled,
  });
  const constantsQ = useQuery({
    queryKey: ['governance', 'constants'],
    queryFn: fetchGovernanceConstants,
    enabled,
  });
  const membersQ = useQuery({
    queryKey: ['governance', 'members', filterCommittee, filterQ],
    queryFn: () =>
      fetchGovernanceMembers({
        limit: 200,
        committeeId: filterCommittee || undefined,
        q: filterQ || undefined,
      }),
    enabled,
  });
  const historyQ = useQuery({
    queryKey: ['governance', 'member-history', historyCommitteeId],
    queryFn: () => fetchCommitteeMemberHistory(historyCommitteeId!),
    enabled: Boolean(historyCommitteeId),
  });
  const compositionQ = useQuery({
    queryKey: ['governance', 'composition', committeeId || filterCommittee],
    queryFn: () => fetchCommitteeComposition(committeeId || filterCommittee),
    enabled: Boolean(committeeId || filterCommittee),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['governance'] });
  };

  const createMut = useMutation({
    mutationFn: () => {
      const payload = buildCreateMemberPayload(committeeId, addForm);
      if (!payload) throw new Error('Incomplete member details');
      return createGovernanceMember(committeeId, payload);
    },
    onSuccess: () => {
      setError('');
      setMessage('Member added successfully.');
      setAddForm(defaultAddMemberForm());
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Unable to add member.')),
  });

  const updateMut = useMutation({
    mutationFn: () =>
      updateGovernanceMember(editMember!.id, {
        role: editMember!.role,
        joiningDate: editMember!.joiningDate?.slice(0, 10),
        endDate: editMember!.endDate?.slice(0, 10),
      }),
    onSuccess: () => {
      setMessage('Member updated.');
      setEditMember(null);
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Unable to update member.')),
  });

  const deactivateMut = useMutation({
    mutationFn: (id: string) => deactivateGovernanceMember(id),
    onSuccess: () => {
      setMessage('Member deactivated.');
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Unable to deactivate member.')),
  });

  const replaceMut = useMutation({
    mutationFn: () => {
      const isExOfficio =
        replaceMember!.memberType === 'EX_OFFICIO' || Boolean(replaceMember!.exOfficioPosition);
      return replaceGovernanceMember(replaceMember!.id, {
        staffProfileId: isExOfficio ? undefined : replaceStaff!.id,
        memberType: replaceMember!.memberType ?? undefined,
        exOfficioPosition: replaceMember!.exOfficioPosition ?? undefined,
        role: replaceRole,
      });
    },
    onSuccess: () => {
      setMessage('Member replaced successfully. Previous tenure preserved in history.');
      setReplaceMember(null);
      setReplaceStaff(null);
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Unable to replace member.')),
  });

  const committees = committeesQ.data?.items ?? [];
  const members = membersQ.data?.items ?? [];
  const roles = constantsQ.data?.memberRoles ?? Object.keys(ROLE_LABELS);
  const exOfficioPositions = constantsQ.data?.exOfficioPositions ?? [
    'PRINCIPAL',
    'VICE_PRINCIPAL',
    'IQAC_COORDINATOR',
    'DEAN',
    'REGISTRAR',
  ];
  const composition = compositionQ.data;

  const stats = statsQ.data;

  const downloadTemplate = async () => {
    const blob = await downloadGovernanceImportTemplate();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'committee-member-import-template.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {(message || error) && (
        <div
          className={cn(
            'rounded-lg border px-4 py-2 text-sm',
            error
              ? 'border-destructive/40 bg-destructive/10 text-destructive'
              : 'border-emerald-500/40 bg-emerald-500/10',
          )}
        >
          {error || message}
        </div>
      )}

      {/* KPI strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total Committees', value: stats?.totalCommittees ?? '—', icon: Users },
          { label: 'Total Members', value: stats?.totalMembers ?? '—', icon: UserCheck },
          { label: 'Expiring Soon', value: stats?.expiringSoon ?? '—', icon: History },
          {
            label: 'Need Replacement',
            value: stats?.membersNeedingReplacement ?? '—',
            icon: AlertTriangle,
            tone: (stats?.membersNeedingReplacement ?? 0) > 0 ? 'text-amber-600' : undefined,
          },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <kpi.icon className={cn('h-8 w-8 text-primary/70', kpi.tone)} />
              <div>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <p className={cn('text-2xl font-semibold tabular-nums', kpi.tone)}>{kpi.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add member form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add committee member</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Committee</Label>
            <select
              className={SELECT_CLASS}
              value={committeeId}
              onChange={(e) => {
                setCommitteeId(e.target.value);
                if (e.target.value) setFilterCommittee(e.target.value);
              }}
            >
              <option value="">Select committee</option>
              {committees.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <CommitteeMemberAddPanel
            form={addForm}
            onChange={setAddForm}
            roles={roles}
            exOfficioPositions={exOfficioPositions}
            roleLabel={roleLabel}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending || !committeeId || !isAddFormValid(addForm)}
            >
              Add member
            </Button>
            <Button type="button" variant="outline" onClick={downloadTemplate}>
              <Download className="mr-2 h-4 w-4" />
              Download Excel template
            </Button>
          </div>
        </CardContent>
      </Card>

      {composition ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Committee composition — {composition.committeeName}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[
                { label: 'Total Members', value: composition.totalMembers },
                { label: 'Internal Staff', value: composition.internalStaff },
                { label: 'External Members', value: composition.externalMembers },
                { label: 'Student Members', value: composition.studentMembers },
                { label: 'Ex-Officio', value: composition.exOfficio },
              ].map((tile) => (
                <div
                  key={tile.label}
                  className="rounded-lg border bg-muted/30 px-3 py-2 text-center"
                >
                  <p className="text-xs text-muted-foreground">{tile.label}</p>
                  <p className="text-2xl font-semibold tabular-nums">{tile.value}</p>
                </div>
              ))}
            </div>

            {composition.naacCompliance.applicable ? (
              <div
                className={cn(
                  'rounded-lg border px-4 py-3',
                  composition.naacCompliance.complete
                    ? 'border-emerald-500/40 bg-emerald-500/5'
                    : 'border-amber-500/40 bg-amber-500/5',
                )}
              >
                <p className="font-medium">
                  NAAC compliance — {composition.naacCompliance.ruleLabel}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {composition.naacCompliance.message}
                </p>
                <ul className="mt-3 space-y-1 text-sm">
                  {(composition.naacCompliance.checks ?? []).map((check) => (
                    <li key={check.id} className="flex items-center gap-2">
                      <span
                        className={cn(
                          'inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold',
                          check.passed
                            ? 'bg-emerald-500/20 text-emerald-700'
                            : 'bg-red-500/20 text-red-700',
                        )}
                      >
                        {check.passed ? '✓' : '✗'}
                      </span>
                      <span>
                        {check.label}
                        {check.detail ? (
                          <span className="text-muted-foreground"> ({check.detail})</span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {/* Filters + table */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Committee membership</CardTitle>
          <div className="flex flex-wrap gap-2">
            <select
              className="rounded-md border bg-background px-2 py-1.5 text-sm"
              value={filterCommittee}
              onChange={(e) => setFilterCommittee(e.target.value)}
            >
              <option value="">All committees</option>
              {committees.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Input
              className="h-9 w-48"
              placeholder="Search…"
              value={filterQ}
              onChange={(e) => setFilterQ(e.target.value)}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => setHistoryCommitteeId(filterCommittee || committees[0]?.id || null)}
              disabled={!committees.length}
            >
              <History className="mr-1 h-4 w-4" />
              History
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Committee</th>
                <th className="px-4 py-3">Organization / Dept</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b align-middle hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">
                    {m.displayName}
                    {m.employeeCode ? (
                      <span className="ml-1 font-mono text-xs text-muted-foreground">
                        ({m.employeeCode})
                      </span>
                    ) : null}
                    {m.replacementRequired ? (
                      <span className="ml-2 text-xs text-amber-600">Needs replacement</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {memberTypeLabel(m.memberType, m.isExternal)}
                    {m.exOfficioPosition ? (
                      <span className="block text-muted-foreground">
                        {m.exOfficioPosition.replace(/_/g, ' ')}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{m.committeeName ?? '—'}</td>
                  <td className="px-4 py-3">{m.organization ?? m.departmentName ?? '—'}</td>
                  <td className="px-4 py-3">{roleLabel(m.role)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatDisplayDate(m.joiningDate)} — {formatDisplayDate(m.endDate)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        m.status === 'ACTIVE'
                          ? 'bg-emerald-500/15 text-emerald-700'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {m.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setViewMember(m)}>
                        View
                      </Button>
                      {m.status === 'ACTIVE' ? (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => setEditMember({ ...m })}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setReplaceMember(m);
                              setReplaceRole(m.role);
                            }}
                          >
                            <RefreshCw className="mr-1 h-3 w-3" />
                            Replace
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => {
                              if (window.confirm(`Deactivate ${m.displayName}?`)) {
                                deactivateMut.mutate(m.id);
                              }
                            }}
                          >
                            Deactivate
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!members.length && !membersQ.isLoading ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No committee members found.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* View dialog */}
      <Dialog open={Boolean(viewMember)} onOpenChange={() => setViewMember(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{viewMember?.displayName}</DialogTitle>
            <DialogDescription>{viewMember?.committeeName}</DialogDescription>
          </DialogHeader>
          {viewMember ? (
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Member type</dt>
                <dd>{memberTypeLabel(viewMember.memberType, viewMember.isExternal)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Role</dt>
                <dd>{roleLabel(viewMember.role)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Employee ID</dt>
                <dd>{viewMember.employeeCode ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Organization / Department</dt>
                <dd>{viewMember.organization ?? viewMember.departmentName ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Designation</dt>
                <dd>{viewMember.designation ?? '—'}</dd>
              </div>
              {viewMember.exOfficioPosition ? (
                <div>
                  <dt className="text-muted-foreground">Ex-officio position</dt>
                  <dd>{viewMember.exOfficioPosition.replace(/_/g, ' ')}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-muted-foreground">Mobile</dt>
                <dd>{viewMember.mobile ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Email</dt>
                <dd>{viewMember.email ?? '—'}</dd>
              </div>
              {viewMember.areaOfExpertise ? (
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Expertise</dt>
                  <dd>{viewMember.areaOfExpertise}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-muted-foreground">From</dt>
                <dd>{formatDisplayDate(viewMember.joiningDate)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">To</dt>
                <dd>{formatDisplayDate(viewMember.endDate)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd>{viewMember.status}</dd>
              </div>
            </dl>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={Boolean(editMember)} onOpenChange={() => setEditMember(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit membership</DialogTitle>
          </DialogHeader>
          {editMember ? (
            <div className="space-y-3">
              <div>
                <Label>Role</Label>
                <select
                  className={SELECT_CLASS}
                  value={editMember.role}
                  onChange={(e) => setEditMember({ ...editMember, role: e.target.value })}
                >
                  {roles.map((r) => (
                    <option key={r} value={r}>
                      {roleLabel(r)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>From date</Label>
                <Input
                  type="date"
                  value={editMember.joiningDate?.slice(0, 10) ?? ''}
                  onChange={(e) => setEditMember({ ...editMember, joiningDate: e.target.value })}
                />
              </div>
              <div>
                <Label>To date</Label>
                <Input
                  type="date"
                  value={editMember.endDate?.slice(0, 10) ?? ''}
                  onChange={(e) => setEditMember({ ...editMember, endDate: e.target.value })}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMember(null)}>
              Cancel
            </Button>
            <Button onClick={() => updateMut.mutate()} disabled={updateMut.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Replace dialog */}
      <Dialog open={Boolean(replaceMember)} onOpenChange={() => setReplaceMember(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace member</DialogTitle>
            <DialogDescription>
              {replaceMember
                ? `Replacing ${replaceMember.displayName} on ${replaceMember.committeeName}. Previous assignment is marked Replaced — history is retained for NAAC audit.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {replaceMember?.memberType === 'EX_OFFICIO' || replaceMember?.exOfficioPosition ? (
              <p className="text-sm text-muted-foreground">
                Ex-officio position:{' '}
                <strong>
                  {(replaceMember.exOfficioPosition ?? 'PRINCIPAL').replace(/_/g, ' ')}
                </strong>{' '}
                — system will assign the current office holder.
              </p>
            ) : (
              <>
                <div>
                  <Label>New member — search staff</Label>
                  <StaffSearchPicker value={replaceStaff} onSelect={setReplaceStaff} />
                </div>
              </>
            )}
            <div>
              <Label>Role</Label>
              <select
                className={SELECT_CLASS}
                value={replaceRole}
                onChange={(e) => setReplaceRole(e.target.value)}
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r)}
                  </option>
                ))}
              </select>
            </div>
            {replaceStaff ? <StaffInfoPanel staff={replaceStaff} /> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplaceMember(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => replaceMut.mutate()}
              disabled={
                replaceMut.isPending ||
                (!replaceMember?.exOfficioPosition &&
                  replaceMember?.memberType !== 'EX_OFFICIO' &&
                  !replaceStaff)
              }
            >
              Save replacement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History dialog */}
      <Dialog open={Boolean(historyCommitteeId)} onOpenChange={() => setHistoryCommitteeId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Committee membership history</DialogTitle>
            <DialogDescription>
              All membership records are retained for NAAC audit — nothing is deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-2">Staff</th>
                  <th className="py-2 pr-2">Role</th>
                  <th className="py-2 pr-2">Period</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {(historyQ.data ?? []).map((h) => (
                  <tr key={h.id} className="border-b">
                    <td className="py-2 pr-2">{h.displayName}</td>
                    <td className="py-2 pr-2">{roleLabel(h.role)}</td>
                    <td className="py-2 pr-2 text-xs">
                      {formatDisplayDate(h.joiningDate)} — {formatDisplayDate(h.endDate)}
                    </td>
                    <td className="py-2">{h.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

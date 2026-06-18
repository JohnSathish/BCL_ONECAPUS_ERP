'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { fetchStaff } from '@/services/staff';
import { fetchStudents } from '@/services/students';
import type { StaffListItem } from '@/types/staff';
import type { StudentDirectoryRow } from '@/types/students';
import { cn } from '@/utils/cn';

export type GovernanceMemberType =
  | 'INTERNAL_STAFF'
  | 'EXTERNAL'
  | 'EX_OFFICIO'
  | 'STUDENT_REPRESENTATIVE'
  | 'ALUMNI_REPRESENTATIVE'
  | 'PARENT_REPRESENTATIVE'
  | 'INDUSTRY_EXPERT';

export const MEMBER_TYPE_OPTIONS: Array<{
  value: GovernanceMemberType;
  label: string;
  hint: string;
}> = [
  { value: 'INTERNAL_STAFF', label: 'Internal Staff', hint: 'Search from staff directory' },
  { value: 'EXTERNAL', label: 'External Member', hint: 'Advocate, NGO, police, nominee' },
  {
    value: 'EX_OFFICIO',
    label: 'Ex-Officio',
    hint: 'Position-based — auto-resolves current holder',
  },
  {
    value: 'STUDENT_REPRESENTATIVE',
    label: 'Student Representative',
    hint: 'Search enrolled student',
  },
  {
    value: 'ALUMNI_REPRESENTATIVE',
    label: 'Alumni Representative',
    hint: 'Alumni association member',
  },
  { value: 'PARENT_REPRESENTATIVE', label: 'Parent Representative', hint: 'PTA / parent nominee' },
  {
    value: 'INDUSTRY_EXPERT',
    label: 'Industry / Expert',
    hint: 'Industry, legal, or subject expert',
  },
];

const SELECT_CLASS = 'mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm';

export type AddMemberFormState = {
  memberType: GovernanceMemberType;
  role: string;
  startDate: string;
  endDate: string;
  selectedStaff: StaffListItem | null;
  selectedStudent: StudentDirectoryRow | null;
  exOfficioPosition: string;
  fullName: string;
  designation: string;
  organization: string;
  mobile: string;
  email: string;
  address: string;
  areaOfExpertise: string;
};

export const defaultAddMemberForm = (): AddMemberFormState => ({
  memberType: 'INTERNAL_STAFF',
  role: 'MEMBER',
  startDate: '',
  endDate: '',
  selectedStaff: null,
  selectedStudent: null,
  exOfficioPosition: 'PRINCIPAL',
  fullName: '',
  designation: '',
  organization: '',
  mobile: '',
  email: '',
  address: '',
  areaOfExpertise: '',
});

function StaffSearchPicker({
  value,
  onSelect,
}: {
  value: StaffListItem | null;
  onSelect: (staff: StaffListItem | null) => void;
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
          placeholder="Search staff by name or employee code"
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
              <span className="font-medium">{staff.fullName}</span>
              <span className="text-xs text-muted-foreground">
                {staff.employeeCode}
                {staff.department ? ` · ${staff.department}` : ''}
              </span>
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

function StudentSearchPicker({
  value,
  onSelect,
}: {
  value: StudentDirectoryRow | null;
  onSelect: (student: StudentDirectoryRow | null) => void;
}) {
  const enabled = useAuthQueryEnabled();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value?.fullName ?? '');
  const debounced = useDebouncedValue(query, 300);

  const searchQ = useQuery({
    queryKey: ['students', 'committee-search', debounced],
    queryFn: () => fetchStudents({ search: debounced, limit: 10, studentStatus: 'STUDYING' }),
    enabled: enabled && open && debounced.trim().length >= 2,
  });

  const results = searchQ.data?.data ?? [];

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Search student by name or enrollment no."
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
          {results.map((student) => (
            <button
              key={student.id}
              type="button"
              className="flex w-full flex-col items-start border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted/60"
              onClick={() => {
                onSelect(student);
                setQuery(student.fullName);
                setOpen(false);
              }}
            >
              <span className="font-medium">{student.fullName}</span>
              <span className="text-xs text-muted-foreground">
                {student.enrollmentNumber}
                {student.programme ? ` · ${student.programme}` : ''}
              </span>
            </button>
          ))}
          {!searchQ.isLoading && !results.length ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">No students found.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function StaffInfoPanel({ staff }: { staff: StaffListItem }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm md:col-span-2">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Staff information (auto-loaded)
      </p>
      <dl className="grid gap-2 sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Name</dt>
          <dd className="font-medium">{staff.fullName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Employee code</dt>
          <dd className="font-mono">{staff.employeeCode}</dd>
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

type Props = {
  form: AddMemberFormState;
  onChange: (next: AddMemberFormState) => void;
  roles: string[];
  exOfficioPositions: string[];
  roleLabel: (role: string) => string;
};

export function CommitteeMemberAddPanel({
  form,
  onChange,
  roles,
  exOfficioPositions,
  roleLabel,
}: Props) {
  const set = (patch: Partial<AddMemberFormState>) => onChange({ ...form, ...patch });

  const isExternalLike = [
    'EXTERNAL',
    'ALUMNI_REPRESENTATIVE',
    'PARENT_REPRESENTATIVE',
    'INDUSTRY_EXPERT',
  ].includes(form.memberType);

  return (
    <div className="space-y-4">
      <div>
        <Label className="mb-2 block">Member type</Label>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {MEMBER_TYPE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={cn(
                'flex cursor-pointer gap-2 rounded-lg border p-3 text-sm transition',
                form.memberType === opt.value
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                  : 'border-border hover:bg-muted/40',
              )}
            >
              <input
                type="radio"
                name="memberType"
                className="mt-0.5"
                checked={form.memberType === opt.value}
                onChange={() =>
                  set({
                    memberType: opt.value,
                    selectedStaff: null,
                    selectedStudent: null,
                  })
                }
              />
              <span>
                <span className="block font-medium">{opt.label}</span>
                <span className="text-xs text-muted-foreground">{opt.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {form.memberType === 'INTERNAL_STAFF' ? (
          <div className="md:col-span-2">
            <Label>Search staff</Label>
            <StaffSearchPicker
              value={form.selectedStaff}
              onSelect={(staff) => set({ selectedStaff: staff })}
            />
          </div>
        ) : null}

        {form.memberType === 'STUDENT_REPRESENTATIVE' ? (
          <div className="md:col-span-2">
            <Label>Search student</Label>
            <StudentSearchPicker
              value={form.selectedStudent}
              onSelect={(student) => set({ selectedStudent: student })}
            />
          </div>
        ) : null}

        {form.memberType === 'EX_OFFICIO' ? (
          <div className="md:col-span-2">
            <Label>Ex-officio position</Label>
            <select
              className={SELECT_CLASS}
              value={form.exOfficioPosition}
              onChange={(e) => set({ exOfficioPosition: e.target.value })}
            >
              {exOfficioPositions.map((p) => (
                <option key={p} value={p}>
                  {p.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              System automatically assigns the current office holder. When the Principal changes,
              the committee roster updates without manual correction.
            </p>
          </div>
        ) : null}

        {isExternalLike ? (
          <>
            <div>
              <Label>Full name *</Label>
              <Input
                value={form.fullName}
                onChange={(e) => set({ fullName: e.target.value })}
                placeholder="Dr Jacqueline R Marak"
              />
            </div>
            <div>
              <Label>Designation *</Label>
              <Input
                value={form.designation}
                onChange={(e) => set({ designation: e.target.value })}
                placeholder="Advocate"
              />
            </div>
            <div>
              <Label>Organization *</Label>
              <Input
                value={form.organization}
                onChange={(e) => set({ organization: e.target.value })}
                placeholder="District Legal Services Authority"
              />
            </div>
            <div>
              <Label>Mobile number</Label>
              <Input value={form.mobile} onChange={(e) => set({ mobile: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set({ email: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => set({ address: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label>Area of expertise</Label>
              <Input
                value={form.areaOfExpertise}
                onChange={(e) => set({ areaOfExpertise: e.target.value })}
                placeholder="Women's rights, legal compliance, industry liaison…"
              />
            </div>
          </>
        ) : null}

        <div>
          <Label>Committee role</Label>
          <select
            className={SELECT_CLASS}
            value={form.role}
            onChange={(e) => set({ role: e.target.value })}
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
            value={form.startDate}
            onChange={(e) => set({ startDate: e.target.value })}
          />
        </div>
        <div>
          <Label>To date</Label>
          <Input
            type="date"
            value={form.endDate}
            onChange={(e) => set({ endDate: e.target.value })}
          />
        </div>
      </div>

      {form.selectedStaff ? <StaffInfoPanel staff={form.selectedStaff} /> : null}
    </div>
  );
}

export function buildCreateMemberPayload(
  committeeId: string,
  form: AddMemberFormState,
): Record<string, unknown> | null {
  const base = {
    committeeId,
    role: form.role,
    joiningDate: form.startDate || undefined,
    endDate: form.endDate || undefined,
    memberType: form.memberType,
  };

  switch (form.memberType) {
    case 'INTERNAL_STAFF':
      if (!form.selectedStaff) return null;
      return {
        ...base,
        staffProfileId: form.selectedStaff.id,
        displayName: form.selectedStaff.fullName,
      };
    case 'STUDENT_REPRESENTATIVE':
      if (!form.selectedStudent) return null;
      return {
        ...base,
        studentId: form.selectedStudent.id,
        displayName: form.selectedStudent.fullName,
        role: form.role || 'STUDENT_REPRESENTATIVE',
      };
    case 'EX_OFFICIO':
      return {
        ...base,
        exOfficioPosition: form.exOfficioPosition,
        displayName: form.exOfficioPosition.replace(/_/g, ' '),
        role: form.role || 'EX_OFFICIO',
      };
    case 'EXTERNAL':
    case 'ALUMNI_REPRESENTATIVE':
    case 'PARENT_REPRESENTATIVE':
    case 'INDUSTRY_EXPERT':
      if (!form.fullName.trim() || !form.designation.trim() || !form.organization.trim()) {
        return null;
      }
      return {
        ...base,
        displayName: form.fullName.trim(),
        designation: form.designation.trim(),
        organization: form.organization.trim(),
        mobile: form.mobile || undefined,
        email: form.email || undefined,
        address: form.address || undefined,
        areaOfExpertise: form.areaOfExpertise || undefined,
        isExternal: true,
      };
    default:
      return null;
  }
}

export function isAddFormValid(form: AddMemberFormState) {
  return buildCreateMemberPayload('x', form) !== null;
}

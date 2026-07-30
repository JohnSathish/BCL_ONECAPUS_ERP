'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { fetchAllCourses } from '@/services/programs';
import { fetchInfrastructureRooms } from '@/services/infrastructure';
import { fetchStaff } from '@/services/staff';
import { fetchFacultyShiftAssignments } from '@/services/faculty-shifts';
import { ShiftAssignmentBadges } from '@/components/academics/shift-assignment-badges';
import { TimetableFacultySearchSelect } from '@/components/timetable/timetable-faculty-search-select';
import { fetchTeachingSubjectGroups } from '@/services/teaching-subject-groups';
import { isPoolFyugpCategory } from '@/lib/timetable/entry-display';
import type { ManualEntryPayload, TimetableEntry } from '@/services/timetable';

const CATEGORIES = ['MAJOR', 'MINOR', 'MDC', 'AEC', 'SEC', 'VAC', 'VTC', 'LAB'];
const DAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export type SlotModalContext = {
  planId: string;
  shiftId?: string;
  dayOfWeek: number;
  periodNo?: number;
  startTime: string;
  endTime: string;
  slotTemplateId?: string;
  allowedSemesters: number[];
  defaultSemester?: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  context?: SlotModalContext;
  entry?: TimetableEntry | null;
  busy?: boolean;
  errorMessage?: string | null;
  onSave: (payload: ManualEntryPayload) => void;
  onDelete?: (entryId: string) => void;
};

export function TimetableSlotModal({
  open,
  onClose,
  context,
  entry,
  busy,
  errorMessage,
  onSave,
  onDelete,
}: Props) {
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [periodNo, setPeriodNo] = useState<number | ''>('');
  const [semesterSequence, setSemesterSequence] = useState<number | ''>('');
  const [sectionCode, setSectionCode] = useState('');
  const [useSubjectGroup, setUseSubjectGroup] = useState(true);
  const [teachingSubjectGroupId, setTeachingSubjectGroupId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [staffProfileId, setStaffProfileId] = useState('');
  const [classroomId, setClassroomId] = useState('');
  const [fyugpCategory, setFyugpCategory] = useState('MAJOR');
  const [categoryOnlyPeriod, setCategoryOnlyPeriod] = useState(false);
  const [coFacultyIds, setCoFacultyIds] = useState<string[]>([]);
  const [coFacultyPick, setCoFacultyPick] = useState('');
  const [facultySearch, setFacultySearch] = useState('');
  const [coFacultySearch, setCoFacultySearch] = useState('');
  const [pickedStaffCache, setPickedStaffCache] = useState<
    Record<
      string,
      {
        id: string;
        fullName: string;
        shortCode?: string | null;
        employeeCode?: string | null;
        assignedShifts?: Array<{ id: string; code: string; name: string; isPrimary: boolean }>;
      }
    >
  >({});
  const authReady = useAuthQueryEnabled();
  const debouncedFacultySearch = useDebouncedValue(facultySearch, 250);
  const debouncedCoFacultySearch = useDebouncedValue(coFacultySearch, 250);

  const coursesQ = useQuery({
    queryKey: ['timetable', 'courses'],
    queryFn: () => fetchAllCourses(),
    enabled: authReady && open,
  });
  const staffQ = useQuery({
    queryKey: ['timetable', 'staff', context?.shiftId, debouncedFacultySearch],
    queryFn: async () => {
      if (context?.shiftId) {
        return fetchFacultyShiftAssignments(context.shiftId, {
          limit: 200,
          search: debouncedFacultySearch.trim() || undefined,
        });
      }
      const result = await fetchStaff({
        activeTeachingOnly: true,
        limit: 100,
        search: debouncedFacultySearch.trim() || undefined,
      });
      return result.data;
    },
    enabled: authReady && open,
  });
  const coStaffQ = useQuery({
    queryKey: ['timetable', 'staff', 'co', context?.shiftId, debouncedCoFacultySearch],
    queryFn: async () => {
      if (context?.shiftId) {
        return fetchFacultyShiftAssignments(context.shiftId, {
          limit: 200,
          search: debouncedCoFacultySearch.trim() || undefined,
        });
      }
      const result = await fetchStaff({
        activeTeachingOnly: true,
        limit: 100,
        search: debouncedCoFacultySearch.trim() || undefined,
      });
      return result.data;
    },
    enabled: authReady && open,
  });
  const roomsQ = useQuery({
    queryKey: ['timetable', 'rooms'],
    queryFn: () => fetchInfrastructureRooms({ status: 'ACTIVE' }),
    enabled: authReady && open,
  });
  const subjectGroupsQ = useQuery({
    queryKey: ['timetable', 'subject-groups', semesterSequence, fyugpCategory],
    queryFn: () =>
      fetchTeachingSubjectGroups({
        semesterNo: Number(semesterSequence),
        fyugpCategory,
      }),
    enabled: authReady && open && !!semesterSequence,
  });

  useEffect(() => {
    if (!open) return;
    setDayOfWeek(entry?.dayOfWeek ?? context?.dayOfWeek ?? 1);
    setPeriodNo(entry?.periodNo ?? context?.periodNo ?? '');
    setSemesterSequence(
      entry?.semesterSequence ?? context?.defaultSemester ?? context?.allowedSemesters[0] ?? '',
    );
    setSectionCode(entry?.sectionCode ?? '');
    setTeachingSubjectGroupId(entry?.teachingSubjectGroupId ?? '');
    setUseSubjectGroup(Boolean(entry?.teachingSubjectGroupId ?? true));
    setCourseId(entry?.courseId ?? '');
    setStaffProfileId(
      entry?.staffProfileId ??
        (entry?.staffProfile as { id?: string } | null | undefined)?.id ??
        '',
    );
    setClassroomId(entry?.classroomId ?? '');
    setFyugpCategory(entry?.fyugpCategory ?? 'MAJOR');
    setCategoryOnlyPeriod(
      Boolean(
        (entry?.metadata as { displayAsCategoryOnly?: boolean } | undefined)?.displayAsCategoryOnly,
      ) ||
        (isPoolFyugpCategory(entry?.fyugpCategory) &&
          !entry?.courseId &&
          !entry?.teachingSubjectGroupId),
    );
    setCoFacultyIds([]);
    setFacultySearch('');
    setCoFacultySearch('');
    setPickedStaffCache({});
  }, [open, entry, context]);

  useEffect(() => {
    if (!open || entry?.courseId || entry?.teachingSubjectGroupId) return;
    if (isPoolFyugpCategory(fyugpCategory)) {
      setCategoryOnlyPeriod(true);
    }
  }, [open, fyugpCategory, entry?.courseId, entry?.teachingSubjectGroupId]);

  useEffect(() => {
    if (!teachingSubjectGroupId) return;
    const group = (subjectGroupsQ.data ?? []).find((g) => g.id === teachingSubjectGroupId);
    if (group?.primaryStaffProfileId && !staffProfileId) {
      setStaffProfileId(group.primaryStaffProfileId);
    }
  }, [teachingSubjectGroupId, subjectGroupsQ.data, staffProfileId]);

  if (!open || !context) return null;

  const courses = coursesQ.data?.data ?? [];
  const mapStaffRows = (rows: unknown[] | undefined) =>
    (rows ?? [])
      .filter((row) => {
        const staffType = (row as { staffType?: string }).staffType;
        return !staffType || staffType === 'TEACHING';
      })
      .map((row) => {
        const r = row as {
          id: string;
          staffProfileId?: string;
          fullName: string;
          shortCode?: string | null;
          employeeCode?: string | null;
          assignedShifts?: Array<{ id: string; code: string; name: string; isPrimary: boolean }>;
        };
        return {
          id: r.staffProfileId ?? r.id,
          fullName: r.fullName,
          shortCode: r.shortCode,
          employeeCode: r.employeeCode,
          assignedShifts: r.assignedShifts,
        };
      });
  const staff = mapStaffRows(staffQ.data as unknown[] | undefined);
  const coStaff = mapStaffRows(coStaffQ.data as unknown[] | undefined);
  const rooms = roomsQ.data ?? [];
  const subjectGroups = subjectGroupsQ.data ?? [];
  const selectedFromLists =
    staff.find((m) => m.id === staffProfileId) ??
    coStaff.find((m) => m.id === staffProfileId) ??
    pickedStaffCache[staffProfileId];
  const selectedStaff =
    selectedFromLists ??
    (staffProfileId && entry?.staffProfile
      ? {
          id: staffProfileId,
          fullName: entry.staffProfile.fullName,
          shortCode: entry.staffProfile.shortCode,
          employeeCode: null,
          assignedShifts: undefined as
            | Array<{ id: string; code: string; name: string; isPrimary: boolean }>
            | undefined,
        }
      : undefined);
  const primaryOptions = selectedStaff
    ? [selectedStaff, ...staff.filter((m) => m.id !== selectedStaff.id)]
    : staff;
  const coOptions = coStaff;

  const rememberStaff = (id: string, list: typeof staff) => {
    const member = list.find((m) => m.id === id);
    if (member) {
      setPickedStaffCache((prev) => ({ ...prev, [id]: member }));
    }
  };
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!semesterSequence || !periodNo) return;
    const poolPeriod = categoryOnlyPeriod && isPoolFyugpCategory(fyugpCategory);
    onSave({
      planId: context.planId,
      dayOfWeek,
      periodNo: Number(periodNo),
      startTime: context.startTime,
      endTime: context.endTime,
      slotTemplateId: context.slotTemplateId,
      semesterSequence: Number(semesterSequence),
      sectionCode: sectionCode || undefined,
      teachingSubjectGroupId:
        !poolPeriod && useSubjectGroup && teachingSubjectGroupId
          ? teachingSubjectGroupId
          : undefined,
      courseId: !poolPeriod && !useSubjectGroup && courseId ? courseId : undefined,
      staffProfileId: staffProfileId ? staffProfileId : null,
      classroomId: classroomId || undefined,
      fyugpCategory,
      slotType: fyugpCategory === 'LAB' ? 'LAB' : 'THEORY',
      metadata: poolPeriod ? { displayAsCategoryOnly: true } : { displayAsCategoryOnly: false },
      facultyTeam: coFacultyIds.map((id) => ({ staffProfileId: id, role: 'CO_FACULTY' })),
    });
  };

  const showPoolPeriodOption = isPoolFyugpCategory(fyugpCategory);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl border border-border bg-card p-5 shadow-xl">
        <h3 className="text-lg font-semibold">
          {entry ? 'Edit Timetable Slot' : 'Add Timetable Slot'}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {context.startTime.slice(0, 5)} – {context.endTime.slice(0, 5)}
          {periodNo ? ` · Period P${periodNo}` : ''}
        </p>
        {errorMessage ? (
          <div className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {errorMessage}
          </div>
        ) : null}
        <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
          <label className="block space-y-1 text-xs font-medium text-muted-foreground">
            Day
            <select
              className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(Number(e.target.value))}
            >
              {DAYS.map((day) => (
                <option key={day.value} value={day.value}>
                  {day.label}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-xs font-medium text-muted-foreground">
              Period
              <Input
                type="number"
                min={1}
                max={7}
                value={periodNo}
                onChange={(e) => setPeriodNo(e.target.value ? Number(e.target.value) : '')}
                required
              />
            </label>
            <label className="space-y-1 text-xs font-medium text-muted-foreground">
              Semester
              <select
                className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
                value={semesterSequence}
                onChange={(e) => setSemesterSequence(Number(e.target.value))}
                required
              >
                {context.allowedSemesters.map((sem) => (
                  <option key={sem} value={sem}>
                    Semester {sem}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block space-y-1 text-xs font-medium text-muted-foreground">
            Section
            <Input
              value={sectionCode}
              onChange={(e) => setSectionCode(e.target.value)}
              placeholder="A / B / Core"
            />
          </label>
          <label className="block space-y-1 text-xs font-medium text-muted-foreground">
            FYUGP Category
            <select
              className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
              value={fyugpCategory}
              onChange={(e) => {
                setFyugpCategory(e.target.value);
                setTeachingSubjectGroupId('');
              }}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </label>
          {showPoolPeriodOption ? (
            <label className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs leading-5 text-foreground">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={categoryOnlyPeriod}
                onChange={(event) => {
                  setCategoryOnlyPeriod(event.target.checked);
                  if (event.target.checked) {
                    setTeachingSubjectGroupId('');
                    setCourseId('');
                  }
                }}
              />
              <span>
                <strong>Category period only</strong> — print and department routine show{' '}
                <strong>{fyugpCategory}</strong> label only (no single paper name). Use this for
                VTC/MDC pools when students choose different subjects.
              </span>
            </label>
          ) : null}
          {!categoryOnlyPeriod ? (
            <>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  className={`rounded-md border px-3 py-1 ${useSubjectGroup ? 'bg-primary text-primary-foreground' : ''}`}
                  onClick={() => setUseSubjectGroup(true)}
                >
                  Subject group
                </button>
                <button
                  type="button"
                  className={`rounded-md border px-3 py-1 ${!useSubjectGroup ? 'bg-primary text-primary-foreground' : ''}`}
                  onClick={() => setUseSubjectGroup(false)}
                >
                  Single paper
                </button>
              </div>
              {useSubjectGroup ? (
                <label className="block space-y-1 text-xs font-medium text-muted-foreground">
                  Teaching subject group
                  <select
                    className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
                    value={teachingSubjectGroupId}
                    onChange={(e) => setTeachingSubjectGroupId(e.target.value)}
                    disabled={subjectGroupsQ.isLoading}
                  >
                    <option value="">
                      {subjectGroupsQ.isLoading
                        ? 'Loading groups…'
                        : subjectGroups.length
                          ? 'Select group (e.g. Major Sociology)'
                          : 'No groups — create in Subject Groups page'}
                    </option>
                    {subjectGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.code} · {group.title}
                        {(group.papers?.length ?? 0) > 0 ? ` (${group.papers?.length} papers)` : ''}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="block space-y-1 text-xs font-medium text-muted-foreground">
                  University paper
                  <select
                    className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
                    value={courseId}
                    onChange={(e) => setCourseId(e.target.value)}
                    disabled={coursesQ.isLoading}
                  >
                    <option value="">
                      {coursesQ.isLoading
                        ? 'Loading courses…'
                        : coursesQ.isError
                          ? 'Failed to load courses'
                          : courses.length
                            ? 'Select course'
                            : 'No courses found'}
                    </option>
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.code} · {course.title}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </>
          ) : null}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              Primary Faculty (short code on print)
            </p>
            <TimetableFacultySearchSelect
              value={staffProfileId}
              options={primaryOptions}
              onChange={(id) => {
                rememberStaff(id, staff);
                setStaffProfileId(id);
              }}
              searchQuery={facultySearch}
              onSearchChange={setFacultySearch}
              loading={staffQ.isLoading}
              error={staffQ.isError}
              emptyHint={
                context.shiftId
                  ? facultySearch.trim()
                    ? `No shift-assigned faculty match “${facultySearch.trim()}”`
                    : 'No faculty assigned to this shift yet'
                  : 'No active teaching staff found'
              }
              placeholder={
                context.shiftId
                  ? 'Search faculty eligible for this shift…'
                  : 'Search active teaching staff…'
              }
            />
            {context.shiftId ? (
              <p className="text-[11px] leading-5 text-muted-foreground">
                Search by name or code. Staff whose teaching category or primary shift matches this
                plan are included. If someone is still missing, check{' '}
                <Link
                  href="/admin/academics/shift-faculty"
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  Academics → Shift Faculty
                </Link>
                .
              </p>
            ) : null}
            {!selectedStaff && staffProfileId && entry?.staffProfile ? (
              <p className="text-[11px] leading-5 text-amber-700">
                Print still shows{' '}
                <strong>{entry.staffProfile.shortCode ?? entry.staffProfile.fullName}</strong> from
                an earlier save. Leave faculty blank and click Update Slot to clear it.
              </p>
            ) : null}
            {selectedStaff?.assignedShifts?.length ? (
              <ShiftAssignmentBadges
                className="pt-1"
                shifts={selectedStaff.assignedShifts}
                currentShiftId={context.shiftId}
              />
            ) : null}
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Co-faculty</p>
            <div className="flex gap-2">
              <TimetableFacultySearchSelect
                className="flex-1"
                value={coFacultyPick}
                options={coOptions}
                onChange={(id) => {
                  rememberStaff(id, coStaff);
                  setCoFacultyPick(id);
                }}
                searchQuery={coFacultySearch}
                onSearchChange={setCoFacultySearch}
                loading={coStaffQ.isLoading}
                error={coStaffQ.isError}
                excludeIds={[staffProfileId, ...coFacultyIds].filter(Boolean)}
                emptyHint="No matching co-faculty"
                placeholder="Search co-faculty…"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  if (coFacultyPick) {
                    setCoFacultyIds((prev) => [...prev, coFacultyPick]);
                    setCoFacultyPick('');
                    setCoFacultySearch('');
                  }
                }}
              >
                Add
              </Button>
            </div>
            {coFacultyIds.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {coFacultyIds.map((id) => {
                  const member =
                    staff.find((row) => row.id === id) ??
                    coStaff.find((row) => row.id === id) ??
                    pickedStaffCache[id];
                  return (
                    <button
                      key={id}
                      type="button"
                      className="rounded-full border border-border px-2 py-1 text-[11px]"
                      onClick={() => setCoFacultyIds((prev) => prev.filter((row) => row !== id))}
                    >
                      {member?.shortCode ?? member?.fullName ?? id} ×
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
          <label className="block space-y-1 text-xs font-medium text-muted-foreground">
            Room / Lab (optional — TBA for draft)
            <select
              className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
              value={classroomId}
              onChange={(e) => setClassroomId(e.target.value)}
            >
              <option value="">Room TBA</option>
              {(Array.isArray(rooms) ? rooms : []).map(
                (room: { id: string; code: string; name: string }) => (
                  <option key={room.id} value={room.id}>
                    {room.code} · {room.name}
                  </option>
                ),
              )}
            </select>
          </label>
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            {entry && onDelete ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={busy}
                onClick={() => {
                  const ok = window.confirm(
                    'Delete this timetable slot? This cannot be undone from the grid.',
                  );
                  if (ok) onDelete(entry.id);
                }}
              >
                Delete
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              {entry ? 'Update Slot' : 'Add Slot'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

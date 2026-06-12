'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchAllCourses } from '@/services/programs';
import { fetchInfrastructureRooms } from '@/services/infrastructure';
import { fetchAllStaff } from '@/services/staff';
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
  onSave: (payload: ManualEntryPayload) => void;
  onDelete?: (entryId: string) => void;
};

export function TimetableSlotModal({
  open,
  onClose,
  context,
  entry,
  busy,
  onSave,
  onDelete,
}: Props) {
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [periodNo, setPeriodNo] = useState<number | ''>('');
  const [semesterSequence, setSemesterSequence] = useState<number | ''>('');
  const [sectionCode, setSectionCode] = useState('');
  const [courseId, setCourseId] = useState('');
  const [staffProfileId, setStaffProfileId] = useState('');
  const [classroomId, setClassroomId] = useState('');
  const [fyugpCategory, setFyugpCategory] = useState('MAJOR');
  const [coFacultyIds, setCoFacultyIds] = useState<string[]>([]);
  const [coFacultyPick, setCoFacultyPick] = useState('');
  const authReady = useAuthQueryEnabled();

  const coursesQ = useQuery({
    queryKey: ['timetable', 'courses'],
    queryFn: () => fetchAllCourses(),
    enabled: authReady && open,
  });
  const staffQ = useQuery({
    queryKey: ['timetable', 'staff'],
    queryFn: () => fetchAllStaff({ activeTeachingOnly: true }),
    enabled: authReady && open,
  });
  const roomsQ = useQuery({
    queryKey: ['timetable', 'rooms'],
    queryFn: () => fetchInfrastructureRooms({ status: 'ACTIVE' }),
    enabled: authReady && open,
  });

  useEffect(() => {
    if (!open) return;
    setDayOfWeek(entry?.dayOfWeek ?? context?.dayOfWeek ?? 1);
    setPeriodNo(entry?.periodNo ?? context?.periodNo ?? '');
    setSemesterSequence(
      entry?.semesterSequence ?? context?.defaultSemester ?? context?.allowedSemesters[0] ?? '',
    );
    setSectionCode(entry?.sectionCode ?? '');
    setCourseId(entry?.courseId ?? '');
    setStaffProfileId(entry?.staffProfileId ?? '');
    setClassroomId(entry?.classroomId ?? '');
    setFyugpCategory(entry?.fyugpCategory ?? 'MAJOR');
    setCoFacultyIds([]);
  }, [open, entry, context]);

  if (!open || !context) return null;

  const courses = coursesQ.data?.data ?? [];
  const staff = staffQ.data?.data ?? [];
  const rooms = roomsQ.data ?? [];

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!semesterSequence || !periodNo) return;
    onSave({
      planId: context.planId,
      dayOfWeek,
      periodNo: Number(periodNo),
      startTime: context.startTime,
      endTime: context.endTime,
      slotTemplateId: context.slotTemplateId,
      semesterSequence: Number(semesterSequence),
      sectionCode: sectionCode || undefined,
      courseId: courseId || undefined,
      staffProfileId: staffProfileId || undefined,
      classroomId: classroomId || undefined,
      fyugpCategory,
      slotType: fyugpCategory === 'LAB' ? 'LAB' : 'THEORY',
      facultyTeam: coFacultyIds.map((id) => ({ staffProfileId: id, role: 'CO_FACULTY' })),
    });
  };

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
            Subject
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
          <label className="block space-y-1 text-xs font-medium text-muted-foreground">
            Primary Faculty
            <select
              className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
              value={staffProfileId}
              onChange={(e) => setStaffProfileId(e.target.value)}
              disabled={staffQ.isLoading}
            >
              <option value="">
                {staffQ.isLoading
                  ? 'Loading faculty…'
                  : staffQ.isError
                    ? 'Failed to load faculty'
                    : staff.length
                      ? 'Select faculty'
                      : 'No faculty found'}
              </option>
              {staff.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.shortCode ?? member.employeeCode} · {member.fullName}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-xs font-medium text-muted-foreground">
            Co-faculty
            <div className="flex gap-2">
              <select
                className="h-10 flex-1 rounded-md border border-border bg-card px-3 text-sm"
                value={coFacultyPick}
                onChange={(e) => setCoFacultyPick(e.target.value)}
              >
                <option value="">Add co-faculty</option>
                {staff
                  .filter((m) => m.id !== staffProfileId && !coFacultyIds.includes(m.id))
                  .map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.shortCode ?? member.employeeCode} · {member.fullName}
                    </option>
                  ))}
              </select>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  if (coFacultyPick) {
                    setCoFacultyIds((prev) => [...prev, coFacultyPick]);
                    setCoFacultyPick('');
                  }
                }}
              >
                Add
              </Button>
            </div>
            {coFacultyIds.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {coFacultyIds.map((id) => {
                  const member = staff.find((row) => row.id === id);
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
          </label>
          <label className="block space-y-1 text-xs font-medium text-muted-foreground">
            Room / Lab
            <select
              className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
              value={classroomId}
              onChange={(e) => setClassroomId(e.target.value)}
            >
              <option value="">Select room</option>
              {(Array.isArray(rooms) ? rooms : []).map(
                (room: { id: string; code: string; name: string }) => (
                  <option key={room.id} value={room.id}>
                    {room.code} · {room.name}
                  </option>
                ),
              )}
            </select>
          </label>
          <label className="block space-y-1 text-xs font-medium text-muted-foreground">
            Category
            <select
              className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
              value={fyugpCategory}
              onChange={(e) => setFyugpCategory(e.target.value)}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            {entry && onDelete ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={busy}
                onClick={() => onDelete(entry.id)}
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

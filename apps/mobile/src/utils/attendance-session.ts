import type { FacultyAttendanceSession } from '@/services/faculty-attendance';
import { formatTimetableTime } from '@/services/faculty-timetable';

export type AttendanceMarkState = 'pending' | 'marked' | 'locked';

export function getAttendanceMarkState(session: FacultyAttendanceSession): AttendanceMarkState {
  const status = (session.status ?? 'OPEN').toUpperCase();
  if (status === 'LOCKED' || status === 'FROZEN') return 'locked';
  if (status === 'MARKED') return 'marked';
  return 'pending';
}

export function attendanceMarkStateLabel(state: AttendanceMarkState) {
  if (state === 'marked') return 'Marked';
  if (state === 'locked') return 'Locked';
  return 'Pending';
}

export function attendanceActionLabel(state: AttendanceMarkState) {
  if (state === 'locked') return 'View attendance →';
  if (state === 'marked') return 'Review attendance →';
  return 'Take attendance →';
}

export function formatSessionTimeRange(startTime?: string, endTime?: string) {
  if (!startTime || !endTime) return 'Time TBD';
  return `${formatTimetableTime(startTime)} – ${formatTimetableTime(endTime)}`;
}

export function formatSessionRoom(session: FacultyAttendanceSession) {
  const code = session.location?.roomCode?.trim();
  const name = session.location?.roomName?.trim();
  if (code) return code;
  if (!name) return '';
  return name.replace(/^room\s+/i, '');
}

export function sessionDisplayTitle(session: FacultyAttendanceSession) {
  return (
    session.displayTitle ??
    session.subjectGroup?.title ??
    session.course?.title ??
    session.paperCourse?.code ??
    session.course?.code ??
    'Class'
  );
}

export function sessionDisplaySubtitle(session: FacultyAttendanceSession) {
  const paper = session.paperCourse?.code;
  const period = session.periodNo != null ? `Period ${session.periodNo}` : null;
  const section = session.section?.sectionCode ? `Section ${session.section.sectionCode}` : null;
  const room = formatSessionRoom(session);
  return [paper, period, section, room].filter(Boolean).join(' · ');
}

export function sessionCountsLine(session: FacultyAttendanceSession) {
  const counts = session.counts;
  const roster = session.rosterSize;
  if (!counts && roster == null) return null;

  const marked = counts?.total ?? 0;
  const present = counts?.present ?? 0;
  const absent = counts?.absent ?? 0;

  if (roster != null && roster > 0) {
    return `${marked}/${roster} marked · Present ${present} · Absent ${absent}`;
  }
  return `Present ${present} · Absent ${absent} · Marked ${marked}`;
}

export type AttendanceStudent = {
  studentId: string;
  collegeRoll: string;
  name: string;
  nehuRoll: string;
  seat: string;
  subjectCode: string;
  subjectName: string;
  hall: string;
  paperId: string;
};

export type AttendanceIssue = {
  studentId: string;
  collegeRoll: string;
  name: string;
  message: string;
};

export type AttendanceSheet = {
  title: string;
  hall: string;
  subjectCode: string;
  subjectName: string;
  studentCount: number;
  students: AttendanceStudent[];
};

export function attendanceIssues(
  students: AttendanceStudent[],
): AttendanceIssue[] {
  const issues: AttendanceIssue[] = [];
  const seenStudentPaper = new Set<string>();
  const seenSeat = new Set<string>();
  for (const student of students) {
    const personKey = `${student.paperId}|${student.studentId}`;
    if (seenStudentPaper.has(personKey)) {
      issues.push({
        studentId: student.studentId,
        collegeRoll: student.collegeRoll,
        name: student.name,
        message: `Duplicate assignment for ${student.subjectCode}`,
      });
    }
    seenStudentPaper.add(personKey);
    if (!student.seat.trim()) {
      issues.push({
        studentId: student.studentId,
        collegeRoll: student.collegeRoll,
        name: student.name,
        message: `Missing seat number in ${student.hall || 'an unassigned hall'}`,
      });
    } else {
      const seatKey = `${student.hall}|${student.paperId}|${student.seat}`;
      if (seenSeat.has(seatKey)) {
        issues.push({
          studentId: student.studentId,
          collegeRoll: student.collegeRoll,
          name: student.name,
          message: `Duplicate seat ${student.seat} in ${student.hall}`,
        });
      }
      seenSeat.add(seatKey);
    }
  }
  return issues;
}

export function groupAttendanceSheets(
  students: AttendanceStudent[],
  mode: 'subject' | 'hall',
): AttendanceSheet[] {
  if (mode === 'hall') {
    const halls = new Map<string, AttendanceStudent[]>();
    for (const student of students) {
      const key = student.hall || 'Unassigned';
      const list = halls.get(key) ?? [];
      list.push({ ...student, hall: key });
      halls.set(key, list);
    }
    return [...halls.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([hall, rows]) => ({
        title: hall,
        hall,
        subjectCode: uniqueLabels(rows.map((row) => row.subjectCode)),
        subjectName: uniqueLabels(rows.map((row) => row.subjectName)),
        studentCount: rows.length,
        students: rows.sort(byRoll),
      }));
  }

  const groups = new Map<string, AttendanceStudent[]>();
  for (const student of students) {
    const hall = student.hall || 'Unassigned';
    const key = `${student.subjectCode}|${hall}`;
    const list = groups.get(key) ?? [];
    list.push({ ...student, hall });
    groups.set(key, list);
  }
  return [...groups.values()]
    .map((rows) => {
      const first = rows[0]!;
      return {
        title: `${first.subjectCode} ${first.subjectName}`.trim(),
        hall: first.hall,
        subjectCode: first.subjectCode,
        subjectName: first.subjectName,
        studentCount: rows.length,
        students: rows.sort(byRoll),
      };
    })
    .sort(
      (a, b) =>
        a.subjectCode.localeCompare(b.subjectCode) ||
        a.hall.localeCompare(b.hall),
    );
}

function uniqueLabels(values: string[]) {
  return [...new Set(values.filter(Boolean))].join(', ');
}

function byRoll(a: AttendanceStudent, b: AttendanceStudent) {
  return a.collegeRoll.localeCompare(b.collegeRoll, undefined, {
    numeric: true,
  });
}

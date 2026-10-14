import { DEFAULT_DUTY_BANDS, requiredInvigilators } from './ia-duty-rules';
import {
  attendanceIssues,
  groupAttendanceSheets,
  type AttendanceStudent,
} from './ia-attendance-group';

describe('requiredInvigilators', () => {
  it('reads the configured bands instead of a fixed ratio', () => {
    expect(requiredInvigilators(30, DEFAULT_DUTY_BANDS, 1, false, 1)).toBe(1);
    expect(requiredInvigilators(41, DEFAULT_DUTY_BANDS, 1, false, 1)).toBe(2);
    expect(
      requiredInvigilators(41, [{ upTo: 200, invigilators: 1 }], 1, false, 0),
    ).toBe(1);
  });

  it('adds the special-hall extra and respects the minimum', () => {
    expect(
      requiredInvigilators(10, [{ upTo: 40, invigilators: 1 }], 2, false, 1),
    ).toBe(2);
    expect(
      requiredInvigilators(10, [{ upTo: 40, invigilators: 1 }], 1, true, 1),
    ).toBe(2);
    expect(requiredInvigilators(0, DEFAULT_DUTY_BANDS, 1, true, 1)).toBe(0);
  });
});

describe('attendance sheets', () => {
  const rows: AttendanceStudent[] = [
    student('1', 'COM26-12', '114', 'AEC-120', '3'),
    student('2', 'COM26-11', '115', 'AEC-120', '9'),
    student('3', 'COM26-20', '114', 'MDC-110', '4'),
    student('4', 'COM26-30', '114', 'AEC-120', ''),
  ];

  it('splits one subject across halls and groups a hall by subject', () => {
    const bySubject = groupAttendanceSheets(rows, 'subject');
    expect(
      bySubject.map((sheet) => `${sheet.subjectCode}@${sheet.hall}`),
    ).toEqual(['AEC-120@114', 'AEC-120@115', 'MDC-110@114']);
    const hall114 = groupAttendanceSheets(rows, 'hall').find(
      (sheet) => sheet.hall === '114',
    );
    expect(hall114?.studentCount).toBe(3);
    expect(hall114?.subjectCode).toContain('AEC-120');
    expect(hall114?.subjectCode).toContain('MDC-110');
  });

  it('flags a missing seat and a duplicate seat', () => {
    const issues = attendanceIssues([
      ...rows,
      student('5', 'COM26-40', '115', 'AEC-120', '9'),
    ]);
    expect(issues.map((issue) => issue.message).join(' ')).toContain(
      'Missing seat',
    );
    expect(issues.map((issue) => issue.message).join(' ')).toContain(
      'Duplicate seat 9',
    );
  });
});

function student(
  studentId: string,
  collegeRoll: string,
  hall: string,
  subjectCode: string,
  seat: string,
): AttendanceStudent {
  return {
    studentId,
    collegeRoll,
    name: collegeRoll,
    nehuRoll: '',
    seat,
    subjectCode,
    subjectName: subjectCode,
    hall,
    paperId: subjectCode,
  };
}

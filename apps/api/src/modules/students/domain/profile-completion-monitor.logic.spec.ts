import {
  completionPercent,
  isFilled,
  isValidEmail,
  isValidMobile,
  missingFields,
  normalizeRequiredKeys,
  personalizeReminder,
  type MonitorPresence,
} from './profile-completion-monitor.logic';

const present: MonitorPresence = {
  gender: true,
  dob: true,
  bloodGroup: false,
  mobile: true,
  email: true,
  permanentAddress: true,
  presentAddress: true,
  fatherName: false,
  motherName: true,
  photo: true,
};

describe('profile completion monitor', () => {
  it('treats blank and placeholder text as incomplete', () => {
    expect(isFilled('')).toBe(false);
    expect(isFilled('  ')).toBe(false);
    expect(isFilled('n/a')).toBe(false);
    expect(isFilled(null)).toBe(false);
    expect(isFilled('Male')).toBe(true);
  });

  it('accepts only a usable Indian mobile and email', () => {
    expect(isValidMobile('9876543210')).toBe(true);
    expect(isValidMobile('+91 98765 43210')).toBe(true);
    expect(isValidMobile('12345')).toBe(false);
    expect(isValidEmail('student@college.ac.in')).toBe(true);
    expect(isValidEmail('not-an-email')).toBe(false);
  });

  it('counts a student once as incomplete and in each missing field', () => {
    const missing = missingFields(present, normalizeRequiredKeys(undefined));
    expect(missing.map((field) => field.key)).toEqual([
      'bloodGroup',
      'fatherName',
    ]);
    expect(completionPercent(missing.length, 10)).toBe(80);
  });

  it('fills reminder placeholders', () => {
    const text = personalizeReminder(
      'Dear {student_name}, roll {roll_number}: {missing_fields}',
      {
        studentName: 'John Sangma',
        rollNumber: 'BA25-001',
        missingFields: ['Gender', 'Blood Group'],
      },
    );
    expect(text).toContain('John Sangma');
    expect(text).toContain('BA25-001');
    expect(text).toContain('Gender, Blood Group');
  });
});

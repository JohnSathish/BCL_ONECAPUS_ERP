import {
  SCHOOL_SIS_PERMISSION_MANAGE,
  SCHOOL_SIS_PERMISSION_READ,
} from './school-sis.constants';

/** Legacy school-sis:read plus manage — dashboard / shared read surfaces. */
export const SIS_READ = [
  SCHOOL_SIS_PERMISSION_READ,
  SCHOOL_SIS_PERMISSION_MANAGE,
] as const;

export const SIS_DEVICES_VIEW = [
  SCHOOL_SIS_PERMISSION_MANAGE,
  'devices.view',
] as const;

export const SIS_DEVICES_IP = [
  SCHOOL_SIS_PERMISSION_MANAGE,
  'devices.view_ip',
] as const;

export const SIS_DEVICES_REVOKE = [
  SCHOOL_SIS_PERMISSION_MANAGE,
  'devices.revoke',
  'devices.revoke_all',
] as const;

export const SIS_DEVICES_SIGNOUT = [
  SCHOOL_SIS_PERMISSION_MANAGE,
  'devices.signout',
  'devices.revoke',
] as const;

export const SIS_DEVICES_BLOCK = [
  SCHOOL_SIS_PERMISSION_MANAGE,
  'devices.block',
  'devices.unblock',
] as const;

export const SIS_DEVICES_LOGS = [
  SCHOOL_SIS_PERMISSION_MANAGE,
  'devices.security_logs',
  'devices.view',
] as const;

export const SIS_DEVICES_EXPORT = [
  SCHOOL_SIS_PERMISSION_MANAGE,
  'devices.export',
] as const;

export const SIS_STUDENTS_VIEW = [
  SCHOOL_SIS_PERMISSION_READ,
  SCHOOL_SIS_PERMISSION_MANAGE,
  'students.view',
] as const;

export const SIS_STUDENTS_CREATE = [
  SCHOOL_SIS_PERMISSION_MANAGE,
  'students.create',
] as const;

export const SIS_STUDENTS_UPDATE = [
  SCHOOL_SIS_PERMISSION_MANAGE,
  'students.update',
] as const;

/** Intentionally omits school-sis:read so accountants/receptionists cannot open exams. */
export const SIS_EXAMS_VIEW = [
  SCHOOL_SIS_PERMISSION_MANAGE,
  'exams.view',
] as const;

export const SIS_EXAMS_MARKS = [
  SCHOOL_SIS_PERMISSION_MANAGE,
  'exams.marks.enter',
] as const;

export const SIS_EXAMS_PUBLISH = [
  SCHOOL_SIS_PERMISSION_MANAGE,
  'exams.results.publish',
] as const;

export const SIS_EXAMS_CREATE = [
  SCHOOL_SIS_PERMISSION_MANAGE,
  'exams.create',
] as const;

/** Intentionally omits school-sis:read so teachers cannot open fee collection. */
export const SIS_FEES_VIEW = [
  SCHOOL_SIS_PERMISSION_MANAGE,
  'fees.collection.view',
] as const;

export const SIS_FEES_COLLECT = [
  SCHOOL_SIS_PERMISSION_MANAGE,
  'fees.collection.collect',
] as const;

export const SIS_ATTENDANCE_VIEW = [
  SCHOOL_SIS_PERMISSION_MANAGE,
  'attendance.view',
] as const;

export const SIS_ATTENDANCE_MARK = [
  SCHOOL_SIS_PERMISSION_MANAGE,
  'attendance.create',
  'attendance.update',
  'attendance.submit',
] as const;

export const SIS_ATTENDANCE_APPROVE = [
  SCHOOL_SIS_PERMISSION_MANAGE,
  'attendance.approve',
  'attendance.lock',
] as const;

export const SIS_ATTENDANCE_SETTINGS = [
  SCHOOL_SIS_PERMISSION_MANAGE,
  'attendance.settings.manage',
] as const;

export const SIS_ATTENDANCE_CORRECTION = [
  SCHOOL_SIS_PERMISSION_MANAGE,
  'attendance.correction.request',
  'attendance.create',
  'attendance.update',
] as const;

export const SIS_ATTENDANCE_REPORTS = [
  SCHOOL_SIS_PERMISSION_MANAGE,
  'attendance.view',
  'attendance.reports.view',
  'attendance.reports.export',
] as const;

export const SIS_ATTENDANCE_PARENT = [
  SCHOOL_SIS_PERMISSION_MANAGE,
  'school-mobile:parent',
  'school-mobile:student',
  'attendance.view',
] as const;

/** Employee records — not payroll. */
export const SIS_HR_VIEW = [
  SCHOOL_SIS_PERMISSION_MANAGE,
  'hr.employees.view',
  'hr.employees.manage',
] as const;

export const SIS_HR_SELF = ['hr.self.view', 'school-mobile:staff'] as const;

/** Explicit payroll slugs — school-sis:manage alone is not enough. */
export const SIS_PAYROLL_VIEW = [
  'payroll.view',
  'payroll.calculate',
  'payroll.approve',
  'payroll.pay',
] as const;

export const SIS_PAYROLL_CALC = [
  'payroll.calculate',
  'payroll.approve',
] as const;

export const SIS_PAYROLL_APPROVE = ['payroll.approve'] as const;

export const SIS_PAYROLL_PAY = ['payroll.pay', 'payroll.approve'] as const;

export const SIS_TRANSPORT_VIEW = [
  SCHOOL_SIS_PERMISSION_MANAGE,
  SCHOOL_SIS_PERMISSION_READ,
  'transport.view',
  'transport.routes.view',
  'transport.vehicle.view',
  'transport.tracking.view',
  'transport.report.view',
] as const;

export const SIS_TRANSPORT_MANAGE = [
  SCHOOL_SIS_PERMISSION_MANAGE,
  'transport.create',
  'transport.update',
  'transport.delete',
  'transport.routes.manage',
  'transport.vehicle.manage',
  'transport.stop.manage',
  'transport.driver.manage',
  'transport.allocation.manage',
  'transport.trip.manage',
  'transport.incident.manage',
] as const;

export const SIS_TRANSPORT_ATTENDANCE = [
  SCHOOL_SIS_PERMISSION_MANAGE,
  'transport.attendance.manage',
  'transport.trip.manage',
  'school-mobile:staff',
] as const;

export const SIS_TRANSPORT_TRACKING = [
  SCHOOL_SIS_PERMISSION_MANAGE,
  'transport.tracking.view',
  'transport.routes.view',
  'school-mobile:parent',
  'school-mobile:staff',
] as const;

export const SIS_TRANSPORT_FEE = [
  SCHOOL_SIS_PERMISSION_MANAGE,
  'transport.fee.view',
  'transport.fee.manage',
  'fees.collection.view',
] as const;

export const SIS_TRANSPORT_SETTINGS = [
  SCHOOL_SIS_PERMISSION_MANAGE,
  'transport.settings.manage',
] as const;

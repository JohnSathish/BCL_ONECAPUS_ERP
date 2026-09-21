export type AttendanceLockMode =
  | 'AFTER_SUBMIT'
  | 'AFTER_HOURS'
  | 'AFTER_DAYS'
  | 'END_OF_DAY';

export type AttendancePolicy = {
  enabled: boolean;
  allowEditing: boolean;
  allowCorrections: boolean;
  correctionWindowDays: number;
  correctionReasonRequired: boolean;
  teacherCanEditSubmitted: boolean;
  goodPercent: number;
  presentWeight: number;
  lateWeight: number;
  absentWeight: number;
  lockMode: AttendanceLockMode;
  lockAfterDays: number;
  adminCanUnlock: boolean;
  notifyInApp: boolean;
  notifyPush: boolean;
  notifySms: boolean;
  notifyWhatsapp: boolean;
  notifyCorrection: boolean;
  notifyRepeatedAbsence: boolean;
  countHolidaysAsWorking: boolean;
  countWeeklyOffAsWorking: boolean;
  countExamAsWorking: boolean;
  countEventsAsWorking: boolean;
};

export const DEFAULT_ATTENDANCE_POLICY: AttendancePolicy = {
  enabled: true,
  allowEditing: true,
  allowCorrections: true,
  correctionWindowDays: 7,
  correctionReasonRequired: true,
  teacherCanEditSubmitted: false,
  goodPercent: 90,
  presentWeight: 1,
  lateWeight: 1,
  absentWeight: 0,
  lockMode: 'AFTER_DAYS',
  lockAfterDays: 1,
  adminCanUnlock: true,
  notifyInApp: true,
  notifyPush: true,
  notifySms: false,
  notifyWhatsapp: false,
  notifyCorrection: true,
  notifyRepeatedAbsence: true,
  countHolidaysAsWorking: false,
  countWeeklyOffAsWorking: false,
  countExamAsWorking: true,
  countEventsAsWorking: true,
};

function asBool(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function asNum(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function mergeAttendancePolicy(raw?: unknown): AttendancePolicy {
  const src =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const lockMode = String(src.lockMode || DEFAULT_ATTENDANCE_POLICY.lockMode);
  return {
    enabled: asBool(src.enabled, DEFAULT_ATTENDANCE_POLICY.enabled),
    allowEditing: asBool(
      src.allowEditing,
      DEFAULT_ATTENDANCE_POLICY.allowEditing,
    ),
    allowCorrections: asBool(
      src.allowCorrections,
      DEFAULT_ATTENDANCE_POLICY.allowCorrections,
    ),
    correctionWindowDays: Math.max(
      0,
      asNum(
        src.correctionWindowDays,
        DEFAULT_ATTENDANCE_POLICY.correctionWindowDays,
      ),
    ),
    correctionReasonRequired: asBool(
      src.correctionReasonRequired,
      DEFAULT_ATTENDANCE_POLICY.correctionReasonRequired,
    ),
    teacherCanEditSubmitted: asBool(
      src.teacherCanEditSubmitted,
      DEFAULT_ATTENDANCE_POLICY.teacherCanEditSubmitted,
    ),
    goodPercent: asNum(src.goodPercent, DEFAULT_ATTENDANCE_POLICY.goodPercent),
    presentWeight: asNum(
      src.presentWeight,
      DEFAULT_ATTENDANCE_POLICY.presentWeight,
    ),
    lateWeight: asNum(src.lateWeight, DEFAULT_ATTENDANCE_POLICY.lateWeight),
    absentWeight: asNum(
      src.absentWeight,
      DEFAULT_ATTENDANCE_POLICY.absentWeight,
    ),
    lockMode: ([
      'AFTER_SUBMIT',
      'AFTER_HOURS',
      'AFTER_DAYS',
      'END_OF_DAY',
    ].includes(lockMode)
      ? lockMode
      : DEFAULT_ATTENDANCE_POLICY.lockMode) as AttendanceLockMode,
    lockAfterDays: Math.max(
      0,
      asNum(src.lockAfterDays, DEFAULT_ATTENDANCE_POLICY.lockAfterDays),
    ),
    adminCanUnlock: asBool(
      src.adminCanUnlock,
      DEFAULT_ATTENDANCE_POLICY.adminCanUnlock,
    ),
    notifyInApp: asBool(src.notifyInApp, DEFAULT_ATTENDANCE_POLICY.notifyInApp),
    notifyPush: asBool(src.notifyPush, DEFAULT_ATTENDANCE_POLICY.notifyPush),
    notifySms: asBool(src.notifySms, DEFAULT_ATTENDANCE_POLICY.notifySms),
    notifyWhatsapp: asBool(
      src.notifyWhatsapp,
      DEFAULT_ATTENDANCE_POLICY.notifyWhatsapp,
    ),
    notifyCorrection: asBool(
      src.notifyCorrection,
      DEFAULT_ATTENDANCE_POLICY.notifyCorrection,
    ),
    notifyRepeatedAbsence: asBool(
      src.notifyRepeatedAbsence,
      DEFAULT_ATTENDANCE_POLICY.notifyRepeatedAbsence,
    ),
    countHolidaysAsWorking: asBool(
      src.countHolidaysAsWorking,
      DEFAULT_ATTENDANCE_POLICY.countHolidaysAsWorking,
    ),
    countWeeklyOffAsWorking: asBool(
      src.countWeeklyOffAsWorking,
      DEFAULT_ATTENDANCE_POLICY.countWeeklyOffAsWorking,
    ),
    countExamAsWorking: asBool(
      src.countExamAsWorking,
      DEFAULT_ATTENDANCE_POLICY.countExamAsWorking,
    ),
    countEventsAsWorking: asBool(
      src.countEventsAsWorking,
      DEFAULT_ATTENDANCE_POLICY.countEventsAsWorking,
    ),
  };
}

export function policyFromSettingsRow(settings: {
  lateCountsPresent?: boolean;
  policy?: unknown;
}) {
  const policy = mergeAttendancePolicy(settings.policy);
  if (settings.lateCountsPresent === false && policy.lateWeight === 1) {
    policy.lateWeight = 0;
  }
  return policy;
}

export function notifyChannels(policy: AttendancePolicy) {
  return {
    inApp: policy.notifyInApp,
    push: policy.notifyPush,
    sms: policy.notifySms,
    whatsapp: policy.notifyWhatsapp,
  };
}

export function anyNotifyChannel(policy: AttendancePolicy) {
  return (
    policy.notifyInApp ||
    policy.notifyPush ||
    policy.notifySms ||
    policy.notifyWhatsapp
  );
}

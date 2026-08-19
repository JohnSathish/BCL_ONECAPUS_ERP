export type TimetablePrintLayoutKind = 'grid' | 'notice';

export type TimetablePrintParams = {
  planId: string;
  layout?: TimetablePrintLayoutKind;
  semesterSequence?: number;
  staffProfileId?: string;
  classroomId?: string;
  sectionCode?: string;
  autoprint?: boolean;
};

export function buildTimetablePrintUrl(params: TimetablePrintParams): string {
  const qs = new URLSearchParams();
  qs.set('planId', params.planId);
  if (params.layout === 'notice') qs.set('layout', 'notice');
  if (params.layout !== 'notice' && params.semesterSequence != null) {
    qs.set('semester', String(params.semesterSequence));
  }
  if (params.layout !== 'notice' && params.staffProfileId) {
    qs.set('staffProfileId', params.staffProfileId);
  }
  if (params.layout !== 'notice' && params.classroomId) {
    qs.set('classroomId', params.classroomId);
  }
  if (params.layout !== 'notice' && params.sectionCode) {
    qs.set('sectionCode', params.sectionCode);
  }
  if (params.autoprint) qs.set('autoprint', '1');
  return `/admin/academics/timetable/print?${qs.toString()}`;
}

/** Department notice board: Sem 1+3+5 (or 2+4+6) stacked like the printed Garo sheet. */
export function openDepartmentNoticePrint(planId: string): Window | null {
  return openTimetablePrint({ planId, layout: 'notice' });
}

/** Opens a dedicated print-friendly timetable view (new tab). */
export function openTimetablePrint(params: TimetablePrintParams): Window | null {
  if (!params.planId) return null;
  const url = buildTimetablePrintUrl(params);
  return window.open(url, '_blank', 'noopener,noreferrer');
}

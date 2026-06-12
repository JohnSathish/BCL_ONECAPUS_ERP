export type TimetablePrintParams = {
  planId: string;
  semesterSequence?: number;
  staffProfileId?: string;
  classroomId?: string;
  sectionCode?: string;
  autoprint?: boolean;
};

export function buildTimetablePrintUrl(params: TimetablePrintParams): string {
  const qs = new URLSearchParams();
  qs.set('planId', params.planId);
  if (params.semesterSequence != null) {
    qs.set('semester', String(params.semesterSequence));
  }
  if (params.staffProfileId) qs.set('staffProfileId', params.staffProfileId);
  if (params.classroomId) qs.set('classroomId', params.classroomId);
  if (params.sectionCode) qs.set('sectionCode', params.sectionCode);
  if (params.autoprint) qs.set('autoprint', '1');
  return `/admin/academics/timetable/print?${qs.toString()}`;
}

/** Opens a dedicated print-friendly timetable view (new tab). */
export function openTimetablePrint(params: TimetablePrintParams): Window | null {
  if (!params.planId) return null;
  const url = buildTimetablePrintUrl(params);
  return window.open(url, '_blank', 'noopener,noreferrer');
}

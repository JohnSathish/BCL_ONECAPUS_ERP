/**
 * Centralized Calendar Publisher contract (V1 readiness / V2 integrations).
 *
 * Modules should NOT insert AcademicCalendarEvent rows directly.
 * Use AcademicCalendarService:
 *
 *   upsertFromSource(user, {
 *     academicYearId,
 *     sourceModule: 'examinations' | 'admissions' | 'fees' | 'hr' | 'iqac' | 'library' | 'hostel' | ...,
 *     sourceRefId: <stable id from source module>,
 *     type: AcademicCalendarEventType,
 *     title, description?, startDate, endDate?, ...
 *   })
 *
 *   removeFromSource(tenantId, sourceModule, sourceRefId)
 *
 * Source-linked events are read-only in the Admin Interactive Calendar UI.
 * Existing sync hooks (exam / admission / fee) already call these methods.
 */
export const CALENDAR_PUBLISHER_MODULES = [
  'examinations',
  'admissions',
  'fees',
  'hr',
  'iqac',
  'library',
  'hostel',
  'staff_public_holiday',
] as const;

export type CalendarPublisherModule =
  (typeof CALENDAR_PUBLISHER_MODULES)[number];

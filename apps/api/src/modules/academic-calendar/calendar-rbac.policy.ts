import { ForbiddenException } from '@nestjs/common';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import {
  EXAM_TYPES,
  IQAC_TYPES,
  MEETING_TYPES,
} from './academic-calendar.types';

export type CalendarWriteAction = 'create' | 'update' | 'delete' | 'publish';

function roleSet(user: JwtUser): Set<string> {
  return new Set((user.roles ?? []).map((r) => r.toUpperCase()));
}

function hasPerm(user: JwtUser, ...slugs: string[]) {
  const set = new Set(user.permissions ?? []);
  return slugs.some((s) => set.has(s));
}

function isSuperOrInstitutionAdmin(roles: Set<string>) {
  return (
    roles.has('SUPER_ADMIN') ||
    roles.has('SUPERADMIN') ||
    roles.has('INSTITUTION_ADMIN') ||
    roles.has('TENANT_ADMIN') ||
    roles.has('COLLEGE_ADMIN')
  );
}

function isAcademicAdmin(roles: Set<string>) {
  return (
    roles.has('ACADEMIC_ADMIN') ||
    roles.has('ACADEMICS_ADMIN') ||
    roles.has('ACADEMIC_OFFICER')
  );
}

function isExamCell(roles: Set<string>) {
  return (
    roles.has('EXAM_CELL') ||
    roles.has('EXAMINATION_ADMIN') ||
    roles.has('EXAM_ADMIN') ||
    roles.has('CONTROLLER_OF_EXAMINATIONS')
  );
}

function isIqac(roles: Set<string>) {
  return (
    roles.has('IQAC') ||
    roles.has('IQAC_COORDINATOR') ||
    roles.has('IQAC_ADMIN')
  );
}

function isDeptAdmin(roles: Set<string>) {
  return (
    roles.has('DEPARTMENT_ADMIN') ||
    roles.has('DEPT_ADMIN') ||
    roles.has('HOD') ||
    roles.has('HEAD_OF_DEPARTMENT')
  );
}

function isStaffOnly(roles: Set<string>) {
  return (
    roles.has('STAFF') ||
    roles.has('FACULTY') ||
    roles.has('TEACHER') ||
    roles.has('EMPLOYEE')
  );
}

function deptIdsOf(user: JwtUser): string[] {
  return user.dataScope?.departmentIds ?? [];
}

function eventDeptIds(departmentIds: unknown): string[] {
  if (!Array.isArray(departmentIds)) return [];
  return departmentIds.filter((x): x is string => typeof x === 'string');
}

export function canPublishCalendar(user: JwtUser): boolean {
  return (
    hasPerm(user, 'academic-calendar:manage') ||
    isSuperOrInstitutionAdmin(roleSet(user))
  );
}

/**
 * Enforce scoped write access by role / event type / department / ownership.
 * Source-linked events are read-only in the calendar UI (caller should check separately).
 */
export function assertCanWriteEvent(
  user: JwtUser,
  action: CalendarWriteAction,
  event: {
    type: string;
    createdById?: string | null;
    departmentIds?: unknown;
    sourceModule?: string | null;
  },
): void {
  if (action === 'publish') {
    if (!canPublishCalendar(user)) {
      throw new ForbiddenException(
        'Only institution managers can publish calendar events',
      );
    }
    return;
  }

  if (!hasPerm(user, 'academic-calendar:edit', 'academic-calendar:manage')) {
    throw new ForbiddenException('Missing academic-calendar write permission');
  }

  if (event.sourceModule) {
    throw new ForbiddenException(
      `This event is managed by ${event.sourceModule} and cannot be edited in the calendar`,
    );
  }

  const roles = roleSet(user);

  if (
    isSuperOrInstitutionAdmin(roles) ||
    hasPerm(user, 'academic-calendar:manage')
  ) {
    return;
  }

  if (isAcademicAdmin(roles)) {
    return;
  }

  if (isExamCell(roles)) {
    if (!EXAM_TYPES.has(event.type)) {
      throw new ForbiddenException(
        'Exam Cell may only manage exam-type events',
      );
    }
    return;
  }

  if (isIqac(roles)) {
    if (!IQAC_TYPES.has(event.type)) {
      throw new ForbiddenException(
        'IQAC may only manage IQAC / workshop / conference events',
      );
    }
    return;
  }

  if (isDeptAdmin(roles)) {
    const allowed = deptIdsOf(user);
    const eventDepts = eventDeptIds(event.departmentIds);
    if (!user.dataScope?.allDepartments) {
      if (!eventDepts.length || !eventDepts.some((d) => allowed.includes(d))) {
        throw new ForbiddenException(
          'Department Admin may only manage events scoped to their department',
        );
      }
    }
    return;
  }

  if (isStaffOnly(roles) || hasPerm(user, 'academic-calendar:edit')) {
    // Staff: only STAFF_EVENT / personal, and only own records on update/delete
    if (
      !MEETING_TYPES.has(event.type) &&
      event.type !== 'STAFF_EVENT' &&
      event.type !== 'LEAVE'
    ) {
      throw new ForbiddenException(
        'Staff may only create personal / staff events',
      );
    }
    if (
      (action === 'update' || action === 'delete') &&
      event.createdById &&
      event.createdById !== user.sub
    ) {
      throw new ForbiddenException('Staff may only edit their own events');
    }
    return;
  }

  throw new ForbiddenException('Not allowed to modify calendar events');
}

export function assertCanCreateType(
  user: JwtUser,
  type: string,
  departmentIds?: string[],
) {
  assertCanWriteEvent(user, 'create', {
    type,
    departmentIds,
    sourceModule: null,
    createdById: user.sub,
  });
}

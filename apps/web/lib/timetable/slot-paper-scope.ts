/** Major and lab papers belong to the timetable department. Shared pools do not. */
const DEPARTMENT_SCOPED = new Set(['MAJOR', 'LAB']);

/** Categories stored on a course offering. Lab is a slot type, not an offering category. */
const OFFERING_CATEGORIES = new Set(['MAJOR', 'MINOR', 'MDC', 'AEC', 'SEC', 'VAC', 'VTC']);

export function isDepartmentScopedTimetableCategory(category?: string | null) {
  return DEPARTMENT_SCOPED.has(String(category ?? '').toUpperCase());
}

export function timetableOfferingCategory(category?: string | null) {
  const value = String(category ?? '').toUpperCase();
  return OFFERING_CATEGORIES.has(value) ? value : undefined;
}

export function normalizeAcademicLabel(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\b(DEPARTMENT|DEPT|OF)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function courseMatchesTimetableDepartment(
  course: {
    code: string;
    departmentId?: string | null;
    department?: { name?: string | null; code?: string | null } | null;
  },
  department: { id: string; name: string; code: string },
) {
  if (course.departmentId) return course.departmentId === department.id;
  const courseName = normalizeAcademicLabel(course.department?.name ?? '');
  const courseCode = normalizeAcademicLabel(course.department?.code ?? '');
  const departmentName = normalizeAcademicLabel(department.name);
  const departmentCode = normalizeAcademicLabel(department.code);
  if (
    courseName &&
    (courseName === departmentName ||
      courseName.includes(departmentName) ||
      departmentName.includes(courseName))
  ) {
    return true;
  }
  if (courseCode && courseCode === departmentCode) return true;
  const paper = course.code.toUpperCase();
  const prefixes = [department.code, departmentName]
    .map((value) => value.replace(/[^A-Za-z]/g, '').toUpperCase())
    .filter((value) => value.length >= 3);
  return prefixes.some((prefix) => {
    if (paper.startsWith(prefix)) return true;
    const short = prefix.slice(0, 3);
    return new RegExp(`^${short}[^A-Z]`).test(paper);
  });
}

export function findDepartmentForStream<T extends { id: string; name: string; code: string }>(
  departments: T[],
  streamName?: string | null,
  streamCode?: string | null,
) {
  const targets = [streamName, streamCode]
    .map((value) => normalizeAcademicLabel(value ?? ''))
    .filter((value) => value.length >= 3);
  if (!targets.length) return undefined;

  const exact = departments.find((department) => {
    const name = normalizeAcademicLabel(department.name);
    const code = normalizeAcademicLabel(department.code);
    return targets.some((target) => name === target || code === target);
  });
  if (exact) return exact;

  return departments.find((department) => {
    const name = normalizeAcademicLabel(department.name);
    if (name.length < 3) return false;
    return targets.some((target) => name.includes(target) || target.includes(name));
  });
}

export type SlotPaperScope = {
  streamName?: string;
  streamCode?: string;
  /** Faculty timetable: major papers from these departments only. */
  departmentNames?: string[];
};

/**
 * A faculty timetable such as Commerce lists its departments.
 * Major papers stay inside that list. A single department timetable locks to itself.
 */
export function slotStreamScope(input: {
  streams: { id: string; code: string; name: string; departments?: string[] }[];
  streamId?: string;
  planStreamName?: string | null;
  planStreamCode?: string | null;
}): SlotPaperScope {
  const selected = input.streams.find((stream) => stream.id === input.streamId);
  if (selected) {
    const departmentNames = (selected.departments ?? []).map((name) => name.trim()).filter(Boolean);
    if (departmentNames.length > 0) {
      return {
        streamName: selected.name,
        streamCode: selected.code,
        departmentNames,
      };
    }
    return { streamName: selected.name, streamCode: selected.code };
  }
  if (input.planStreamName) {
    return {
      streamName: input.planStreamName,
      streamCode: input.planStreamCode ?? undefined,
    };
  }
  return {};
}

export function departmentsForSlotScope<T extends { id: string; name: string; code: string }>(
  departments: T[],
  scope: SlotPaperScope,
): T[] {
  const named = (scope.departmentNames ?? [])
    .map((name) => findDepartmentForStream(departments, name, name))
    .filter((department): department is T => Boolean(department));
  if (named.length) {
    return [...new Map(named.map((department) => [department.id, department])).values()];
  }
  const single = findDepartmentForStream(departments, scope.streamName, scope.streamCode);
  return single ? [single] : [];
}

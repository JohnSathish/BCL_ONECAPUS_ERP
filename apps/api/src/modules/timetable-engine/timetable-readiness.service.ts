import { Injectable } from '@nestjs/common';
import { TimetableAllocationService } from './timetable-allocation.service';
import { TimetableConflictService } from './timetable-conflict.service';

@Injectable()
export class TimetableReadinessService {
  constructor(
    private readonly allocations: TimetableAllocationService,
    private readonly conflicts: TimetableConflictService,
  ) {}

  async readiness(
    tenantId: string,
    filters: Record<string, string | undefined>,
  ) {
    const allocationRows = await this.allocations.listRows(tenantId, filters);
    const missingFaculty = allocationRows.filter((row) => !row.staffProfileId);
    const missingInitials = allocationRows.filter(
      (row) => row.staffProfileId && !row.facultyInitial,
    );
    const missingWeeklyHours = allocationRows.filter(
      (row) => !Number(row.weeklyHours),
    );
    const overload = allocationRows.filter(
      (row) => row.workloadStatus === 'RED',
    );
    const labWithoutRoom = allocationRows.filter(
      (row) => row.labRequired && !row.preferredRoomId,
    );
    const pendingApproval = allocationRows.filter((row) =>
      ['PENDING', 'DRAFT', 'SUBMITTED'].includes(
        String(row.status ?? '').toUpperCase(),
      ),
    );

    const issues = [
      ...missingFaculty.map((row) =>
        this.issue('MISSING_FACULTY', 'ERROR', row),
      ),
      ...missingInitials.map((row) =>
        this.issue('MISSING_FACULTY_INITIAL', 'WARNING', row),
      ),
      ...missingWeeklyHours.map((row) =>
        this.issue('MISSING_WEEKLY_HOURS', 'ERROR', row),
      ),
      ...overload.map((row) => this.issue('FACULTY_OVERLOAD', 'WARNING', row)),
      ...labWithoutRoom.map((row) =>
        this.issue('LAB_ROOM_MISSING', 'ERROR', row),
      ),
      ...pendingApproval.map((row) =>
        this.issue('ALLOCATION_NOT_APPROVED', 'WARNING', row),
      ),
    ];

    return {
      totalSubjects: allocationRows.length,
      readySubjects:
        allocationRows.length -
        issues.filter((issue) => issue.severity === 'ERROR').length,
      blockingIssues: issues.filter((issue) => issue.severity === 'ERROR')
        .length,
      warnings: issues.filter((issue) => issue.severity === 'WARNING').length,
      readyForGeneration: !issues.some((issue) => issue.severity === 'ERROR'),
      summary: {
        missingFaculty: missingFaculty.length,
        missingInitials: missingInitials.length,
        missingWeeklyHours: missingWeeklyHours.length,
        overload: overload.length,
        labWithoutRoom: labWithoutRoom.length,
        pendingApproval: pendingApproval.length,
      },
      issues,
    };
  }

  async planValidation(tenantId: string, planId: string) {
    const result = await this.conflicts.validatePlan(tenantId, planId);
    return {
      ...result,
      readyForPublish: result.blockingConflicts === 0,
      suggestions: result.conflicts.map((conflict) => ({
        conflictType: conflict.conflictType,
        message: conflict.message,
        action: this.suggestion(conflict.conflictType),
      })),
    };
  }

  private issue(type: string, severity: 'ERROR' | 'WARNING', row: any) {
    return {
      type,
      severity,
      offeringSectionId: row.offeringSectionId,
      department: row.department,
      semester: row.semester,
      subjectCode: row.subjectCode,
      subjectName: row.subjectName,
      paperType: row.paperType,
      message: this.message(type, row),
      fixPath: `/admin/academics/teaching-allocation?sectionId=${row.offeringSectionId}`,
    };
  }

  private message(type: string, row: any) {
    if (type === 'MISSING_FACULTY')
      return `${row.subjectCode} has no faculty assigned.`;
    if (type === 'MISSING_FACULTY_INITIAL')
      return `${row.staffName} has no faculty initial.`;
    if (type === 'MISSING_WEEKLY_HOURS')
      return `${row.subjectCode} is missing weekly hours.`;
    if (type === 'FACULTY_OVERLOAD') return `${row.staffName} is overloaded.`;
    if (type === 'LAB_ROOM_MISSING')
      return `${row.subjectCode} requires a lab/room.`;
    if (type === 'ALLOCATION_NOT_APPROVED')
      return `${row.subjectCode} is not approved.`;
    return `${row.subjectCode} needs attention.`;
  }

  private suggestion(type: string) {
    if (type === 'FACULTY_CLASH')
      return 'Move one class to a free slot or choose another faculty.';
    if (type === 'ROOM_CLASH')
      return 'Choose a different room or mark the entry as a valid shared hall group.';
    if (type === 'CATEGORY_SLOT_RULE_VIOLATION')
      return 'Move this paper to a slot reserved for its category.';
    if (type === 'LAB_ROOM_REQUIRED') return 'Assign a compatible lab room.';
    if (type === 'COMBINED_GROUP_MISSING')
      return 'Add a combined group ID and shared hall.';
    return 'Open conflict resolution and adjust the timetable entry.';
  }
}

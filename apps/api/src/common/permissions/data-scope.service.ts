import { Injectable } from '@nestjs/common';
import type { JwtUser } from '../decorators/current-user.decorator';

type PrismaWhere = Record<string, unknown>;

@Injectable()
export class DataScopeService {
  applyDepartmentScope<T extends PrismaWhere>(where: T, user: JwtUser): T {
    const scope = user.dataScope;
    if (!scope || scope.allDepartments) return where;
    if (!scope.departmentIds?.length) return where;
    return {
      ...where,
      departmentId:
        scope.departmentIds.length === 1
          ? scope.departmentIds[0]
          : { in: scope.departmentIds },
    };
  }

  applyCampusScope<T extends PrismaWhere>(where: T, user: JwtUser): T {
    const scope = user.dataScope;
    if (!scope || scope.allCampuses) return where;
    if (!scope.campusIds?.length) return where;
    return {
      ...where,
      campusId:
        scope.campusIds.length === 1
          ? scope.campusIds[0]
          : { in: scope.campusIds },
    };
  }

  applyProgrammeScope<T extends PrismaWhere>(where: T, user: JwtUser): T {
    const scope = user.dataScope;
    if (!scope?.programmeIds?.length) return where;
    return {
      ...where,
      programId:
        scope.programmeIds.length === 1
          ? scope.programmeIds[0]
          : { in: scope.programmeIds },
    };
  }

  applyStudentListScope<T extends PrismaWhere>(where: T, user: JwtUser): T {
    let next = this.applyDepartmentScope(where, user);
    next = this.applyCampusScope(next, user);
    return this.applyProgrammeScope(next, user);
  }
}

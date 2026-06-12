import { Injectable } from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import type { StudentReportFiltersDto } from '../dto/student-reports.dto';
import type {
  AgeReport,
  CombinationReport,
  DistributionReport,
  ReportBucket,
  StudentReportDashboard,
} from '../student-reports.types';
import { StudentReportsQueryService } from './student-reports-query.service';

const GENDER_LABELS: Record<string, string> = {
  MALE: 'Male',
  FEMALE: 'Female',
  OTHER: 'Other',
};

const NEP_CHOICE_TYPES = ['MDC', 'AEC', 'SEC', 'VAC'] as const;

type StudentRow = {
  id: string;
  departmentId: string | null;
  programVersionId: string | null;
  primaryShiftId: string | null;
  admissionDate: Date | null;
  department: { name: string } | null;
  programVersion: { program: { code: string; name: string } } | null;
  primaryShift: { name: string } | null;
  academicStanding: { currentSemesterSequence: number | null } | null;
  academicProfile: {
    admissionBatch: { entrySession: { name: string } | null } | null;
  } | null;
  masterProfile: {
    fullName: string;
    gender: string | null;
    dateOfBirth: Date | null;
    mobileNumber: string | null;
    email: string | null;
    studentStatus: string;
    ews: boolean;
    categoryLookupId: string | null;
    religionLookupId: string | null;
    denominationLookupId: string | null;
    bloodGroupLookupId: string | null;
    admissionStatus: string;
    admissionType: string | null;
  } | null;
  majorMinorTrack: {
    majorSubject: { name: string };
    minorSubject: { name: string } | null;
  } | null;
  programChoices: { choiceType: string; subjectSlug: string }[];
};

@Injectable()
export class StudentReportsService {
  constructor(private readonly query: StudentReportsQueryService) {}

  private studentSelect = {
    id: true,
    departmentId: true,
    programVersionId: true,
    primaryShiftId: true,
    admissionDate: true,
    department: { select: { name: true } },
    programVersion: {
      select: { program: { select: { code: true, name: true } } },
    },
    primaryShift: { select: { name: true } },
    academicStanding: { select: { currentSemesterSequence: true } },
    academicProfile: {
      select: {
        admissionBatch: {
          select: { entrySession: { select: { name: true } } },
        },
      },
    },
    masterProfile: {
      select: {
        fullName: true,
        gender: true,
        dateOfBirth: true,
        mobileNumber: true,
        email: true,
        studentStatus: true,
        ews: true,
        categoryLookupId: true,
        religionLookupId: true,
        denominationLookupId: true,
        bloodGroupLookupId: true,
        admissionStatus: true,
        admissionType: true,
      },
    },
    majorMinorTrack: {
      select: {
        majorSubject: { select: { name: true } },
        minorSubject: { select: { name: true } },
      },
    },
    programChoices: {
      where: { deletedAt: null, status: 'active' },
      select: { choiceType: true, subjectSlug: true },
    },
  } as const;

  private async loadStudents(
    tenantId: string,
    filters: StudentReportFiltersDto,
    user?: JwtUser,
  ): Promise<StudentRow[]> {
    const where = this.query.buildWhere(tenantId, filters, user);
    return this.query.prisma.student.findMany({
      where,
      select: this.studentSelect,
    }) as Promise<StudentRow[]>;
  }

  private countMap(rows: StudentRow[], keyFn: (r: StudentRow) => string) {
    const map = new Map<string, number>();
    for (const row of rows) {
      const key = keyFn(row);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }

  private lookupBuckets(
    map: Map<string, number>,
    total: number,
    lookup: Map<string, string>,
    fallback = 'Unspecified',
  ): ReportBucket[] {
    const labelFn = (id: string) => lookup.get(id) ?? fallback;
    return this.query.toBuckets(map, total, labelFn);
  }

  private genderBuckets(rows: StudentRow[], total: number): ReportBucket[] {
    const map = this.countMap(
      rows,
      (r) => r.masterProfile?.gender ?? 'UNSPECIFIED',
    );
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({
        key,
        label:
          GENDER_LABELS[key] ?? (key === 'UNSPECIFIED' ? 'Unspecified' : key),
        count,
        percentage: this.query.pct(count, total),
      }));
  }

  async getDashboard(
    tenantId: string,
    filters: StudentReportFiltersDto,
    user?: JwtUser,
  ): Promise<StudentReportDashboard> {
    const where = this.query.buildWhere(tenantId, filters, user);
    const [totalStudents, activeStudents, rows] = await Promise.all([
      this.query.countStudents(where),
      this.query.countActive(where),
      this.loadStudents(tenantId, filters, user),
    ]);

    const programmeMap = this.countMap(rows, (r) =>
      r.programVersion
        ? `${r.programVersion.program.code} — ${r.programVersion.program.name}`
        : 'Unassigned',
    );
    const semesterMap = this.countMap(
      rows,
      (r) => `Semester ${r.academicStanding?.currentSemesterSequence ?? 1}`,
    );
    const shiftMap = this.countMap(
      rows,
      (r) => r.primaryShift?.name ?? 'Unassigned',
    );

    const [categoryLookup] = await Promise.all([
      this.query.loadLookupMap(tenantId, 'CATEGORY'),
    ]);

    const categoryMap = new Map<string, number>();
    for (const r of rows) {
      const id = r.masterProfile?.categoryLookupId ?? '__none__';
      categoryMap.set(id, (categoryMap.get(id) ?? 0) + 1);
    }

    return {
      totalStudents,
      activeStudents,
      programmeWise: this.query.toBuckets(programmeMap, totalStudents),
      semesterWise: this.query.toBuckets(semesterMap, totalStudents),
      shiftWise: this.query.toBuckets(shiftMap, totalStudents),
      genderWise: this.genderBuckets(rows, totalStudents),
      categoryWise: this.lookupBuckets(
        categoryMap,
        totalStudents,
        categoryLookup,
      ),
      updatedAt: new Date().toISOString(),
    };
  }

  async getStrengthReport(
    tenantId: string,
    filters: StudentReportFiltersDto,
    user?: JwtUser,
  ): Promise<
    DistributionReport & {
      activeStudents: number;
      academicYearWise: ReportBucket[];
    }
  > {
    const where = this.query.buildWhere(tenantId, filters, user);
    const [total, activeStudents, rows] = await Promise.all([
      this.query.countStudents(where),
      this.query.countActive(where),
      this.loadStudents(tenantId, filters, user),
    ]);

    const programmeMap = this.countMap(rows, (r) =>
      r.programVersion
        ? `${r.programVersion.program.code} — ${r.programVersion.program.name}`
        : 'Unassigned',
    );
    const semesterMap = this.countMap(
      rows,
      (r) => `Semester ${r.academicStanding?.currentSemesterSequence ?? 1}`,
    );
    const shiftMap = this.countMap(
      rows,
      (r) => r.primaryShift?.name ?? 'Unassigned',
    );
    const yearMap = this.countMap(
      rows,
      (r) => r.academicProfile?.admissionBatch?.entrySession?.name ?? 'Unknown',
    );

    return {
      title: 'Institution Strength Summary',
      total,
      activeStudents,
      buckets: this.query.toBuckets(programmeMap, total),
      academicYearWise: this.query.toBuckets(yearMap, total),
      crossTabs: [
        {
          label: 'Programme-wise',
          buckets: this.query.toBuckets(programmeMap, total),
        },
        {
          label: 'Semester-wise',
          buckets: this.query.toBuckets(semesterMap, total),
        },
        { label: 'Shift-wise', buckets: this.query.toBuckets(shiftMap, total) },
      ],
    };
  }

  async getDepartmentStrength(
    tenantId: string,
    filters: StudentReportFiltersDto,
    user?: JwtUser,
  ): Promise<
    DistributionReport & {
      majorWise: ReportBucket[];
      minorWise: ReportBucket[];
    }
  > {
    const rows = await this.loadStudents(tenantId, filters, user);
    const total = rows.length;

    const deptMap = this.countMap(
      rows,
      (r) => r.department?.name ?? 'Unassigned',
    );
    const majorMap = this.countMap(
      rows,
      (r) => r.majorMinorTrack?.majorSubject.name ?? 'Unassigned',
    );
    const minorMap = this.countMap(
      rows,
      (r) => r.majorMinorTrack?.minorSubject?.name ?? 'Unassigned',
    );

    return {
      title: 'Department Strength',
      total,
      buckets: this.query.toBuckets(deptMap, total),
      majorWise: this.query.toBuckets(majorMap, total),
      minorWise: this.query.toBuckets(minorMap, total),
    };
  }

  async getGenderReport(
    tenantId: string,
    filters: StudentReportFiltersDto,
    user?: JwtUser,
  ): Promise<DistributionReport> {
    const rows = await this.loadStudents(tenantId, filters, user);
    const total = rows.length;
    const buckets = this.genderBuckets(rows, total);
    const male = buckets.find((b) => b.key === 'MALE')?.count ?? 0;
    const female = buckets.find((b) => b.key === 'FEMALE')?.count ?? 0;
    const ratio =
      female > 0
        ? Math.round((male / female) * 100) / 100
        : male > 0
          ? Infinity
          : 0;

    return {
      title: 'Gender Distribution',
      total,
      buckets,
      crossTabs: [
        {
          label: `Gender Ratio (M:F) — ${ratio === Infinity ? 'N/A' : ratio}`,
          buckets,
        },
      ],
    };
  }

  async getCategoryReport(
    tenantId: string,
    filters: StudentReportFiltersDto,
    user?: JwtUser,
  ): Promise<DistributionReport> {
    const rows = await this.loadStudents(tenantId, filters, user);
    const total = rows.length;
    const lookup = await this.query.loadLookupMap(tenantId, 'CATEGORY');

    const categoryMap = new Map<string, number>();
    for (const r of rows) {
      let id = r.masterProfile?.categoryLookupId ?? '__none__';
      if (r.masterProfile?.ews) id = '__ews__';
      categoryMap.set(id, (categoryMap.get(id) ?? 0) + 1);
    }

    const ewsCount = categoryMap.get('__ews__') ?? 0;
    categoryMap.delete('__ews__');
    const buckets = this.lookupBuckets(categoryMap, total, lookup);
    if (ewsCount > 0) {
      buckets.push({
        key: 'EWS',
        label: 'EWS',
        count: ewsCount,
        percentage: this.query.pct(ewsCount, total),
      });
    }

    const deptCross = this.crossTabByDepartment(rows, (r) => {
      if (r.masterProfile?.ews) return 'EWS';
      const id = r.masterProfile?.categoryLookupId;
      return id ? (lookup.get(id) ?? 'Unspecified') : 'Unspecified';
    });

    const genderCross = this.crossTabByGender(rows, (r) => {
      if (r.masterProfile?.ews) return 'EWS';
      const id = r.masterProfile?.categoryLookupId;
      return id ? (lookup.get(id) ?? 'Unspecified') : 'Unspecified';
    });

    return {
      title: 'Category Distribution',
      total,
      buckets,
      crossTabs: [
        { label: 'Category by Department', buckets: deptCross },
        { label: 'Category by Gender', buckets: genderCross },
      ],
    };
  }

  async getReligionReport(
    tenantId: string,
    filters: StudentReportFiltersDto,
    user?: JwtUser,
  ): Promise<DistributionReport> {
    const rows = await this.loadStudents(tenantId, filters, user);
    const total = rows.length;
    const lookup = await this.query.loadLookupMap(tenantId, 'RELIGION');

    const map = new Map<string, number>();
    for (const r of rows) {
      const id = r.masterProfile?.religionLookupId ?? '__none__';
      map.set(id, (map.get(id) ?? 0) + 1);
    }

    return {
      title: 'Religion Distribution',
      total,
      buckets: this.lookupBuckets(map, total, lookup),
      crossTabs: [
        {
          label: 'Religion by Gender',
          buckets: this.crossTabByGender(rows, (r) => {
            const id = r.masterProfile?.religionLookupId;
            return id ? (lookup.get(id) ?? 'Unspecified') : 'Unspecified';
          }),
        },
        {
          label: 'Religion by Department',
          buckets: this.crossTabByDepartment(rows, (r) => {
            const id = r.masterProfile?.religionLookupId;
            return id ? (lookup.get(id) ?? 'Unspecified') : 'Unspecified';
          }),
        },
      ],
    };
  }

  async getDenominationReport(
    tenantId: string,
    filters: StudentReportFiltersDto,
    user?: JwtUser,
  ): Promise<DistributionReport> {
    const rows = await this.loadStudents(tenantId, filters, user);
    const total = rows.length;
    const lookup = await this.query.loadLookupMap(tenantId, 'DENOMINATION');

    const map = new Map<string, number>();
    for (const r of rows) {
      const id = r.masterProfile?.denominationLookupId ?? '__none__';
      map.set(id, (map.get(id) ?? 0) + 1);
    }

    return {
      title: 'Denomination Distribution',
      total,
      buckets: this.lookupBuckets(map, total, lookup),
    };
  }

  async getDepartmentSubjectsReport(
    tenantId: string,
    filters: StudentReportFiltersDto,
    user?: JwtUser,
  ): Promise<DistributionReport> {
    const rows = await this.loadStudents(tenantId, filters, user);
    const total = rows.length;
    const majorMap = this.countMap(
      rows,
      (r) => r.majorMinorTrack?.majorSubject.name ?? 'Unassigned',
    );

    const genderCross = this.crossTabByGender(
      rows.filter((r) => r.majorMinorTrack?.majorSubject),
      (r) => r.majorMinorTrack!.majorSubject.name,
    );
    const categoryLookup = await this.query.loadLookupMap(tenantId, 'CATEGORY');
    const categoryCross = this.crossTabByDepartment(rows, (r) => {
      const id = r.masterProfile?.categoryLookupId;
      return id ? (categoryLookup.get(id) ?? 'Unspecified') : 'Unspecified';
    });

    return {
      title: 'Major Subject Distribution',
      total,
      buckets: this.query.toBuckets(majorMap, total),
      crossTabs: [
        { label: 'Gender by Major', buckets: genderCross },
        { label: 'Category by Department', buckets: categoryCross },
      ],
    };
  }

  async getCombinationsReport(
    tenantId: string,
    filters: StudentReportFiltersDto,
    user?: JwtUser,
  ): Promise<CombinationReport> {
    const rows = await this.loadStudents(tenantId, filters, user);
    const comboMap = new Map<
      string,
      { major: string; minor: string; count: number }
    >();

    for (const r of rows) {
      if (!r.majorMinorTrack) continue;
      const major = r.majorMinorTrack.majorSubject.name;
      const minor = r.majorMinorTrack.minorSubject?.name ?? 'None';
      const key = `${major}::${minor}`;
      const existing = comboMap.get(key);
      if (existing) existing.count += 1;
      else comboMap.set(key, { major, minor, count: 1 });
    }

    const combinations = [...comboMap.values()].sort(
      (a, b) => b.count - a.count,
    );
    return { total: rows.length, combinations };
  }

  async getNepBucketReport(
    tenantId: string,
    choiceType: (typeof NEP_CHOICE_TYPES)[number],
    filters: StudentReportFiltersDto,
    user?: JwtUser,
  ): Promise<DistributionReport> {
    const rows = await this.loadStudents(tenantId, filters, user);
    const map = new Map<string, number>();
    let enrolled = 0;

    for (const r of rows) {
      const choices = r.programChoices.filter(
        (c) => c.choiceType === choiceType,
      );
      if (choices.length === 0) continue;
      enrolled += 1;
      for (const c of choices) {
        map.set(c.subjectSlug, (map.get(c.subjectSlug) ?? 0) + 1);
      }
    }

    return {
      title: `${choiceType} Enrollment`,
      total: enrolled,
      buckets: this.query.toBuckets(map, enrolled),
    };
  }

  async getAgeReport(
    tenantId: string,
    filters: StudentReportFiltersDto,
    user?: JwtUser,
  ): Promise<AgeReport> {
    const rows = await this.loadStudents(tenantId, filters, user);
    const now = new Date();
    const ages: { name: string; age: number }[] = [];

    for (const r of rows) {
      const dob = r.masterProfile?.dateOfBirth;
      if (!dob) continue;
      const age = Math.floor(
        (now.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000),
      );
      ages.push({ name: r.masterProfile!.fullName, age });
    }

    const bucketRanges = [
      { key: '17-18', min: 17, max: 18 },
      { key: '19-20', min: 19, max: 20 },
      { key: '21-22', min: 21, max: 22 },
      { key: '23-25', min: 23, max: 25 },
      { key: '26+', min: 26, max: 999 },
    ];
    const bucketMap = new Map<string, number>();
    for (const b of bucketRanges) bucketMap.set(b.key, 0);
    for (const { age } of ages) {
      const range = bucketRanges.find((b) => age >= b.min && age <= b.max);
      if (range) bucketMap.set(range.key, (bucketMap.get(range.key) ?? 0) + 1);
    }

    const total = ages.length;
    const sorted = [...ages].sort((a, b) => a.age - b.age);

    return {
      total: rows.length,
      averageAge:
        total > 0
          ? Math.round((ages.reduce((s, a) => s + a.age, 0) / total) * 10) / 10
          : null,
      youngest: sorted[0] ?? null,
      oldest: sorted[sorted.length - 1] ?? null,
      buckets: this.query.toBuckets(bucketMap, total || rows.length),
    };
  }

  async getBloodGroupReport(
    tenantId: string,
    filters: StudentReportFiltersDto,
    user?: JwtUser,
  ): Promise<DistributionReport> {
    const rows = await this.loadStudents(tenantId, filters, user);
    const total = rows.length;
    const lookup = await this.query.loadLookupMap(tenantId, 'BLOOD_GROUP');

    const map = new Map<string, number>();
    for (const r of rows) {
      const id = r.masterProfile?.bloodGroupLookupId ?? '__none__';
      map.set(id, (map.get(id) ?? 0) + 1);
    }

    return {
      title: 'Blood Group Distribution',
      total,
      buckets: this.lookupBuckets(map, total, lookup),
    };
  }

  async getAdmissionReport(
    tenantId: string,
    filters: StudentReportFiltersDto,
    user?: JwtUser,
  ): Promise<DistributionReport> {
    const rows = await this.loadStudents(tenantId, filters, user);
    const total = rows.length;

    const statusMap = this.countMap(
      rows,
      (r) => r.masterProfile?.admissionStatus ?? 'Unknown',
    );
    const typeMap = this.countMap(
      rows,
      (r) => r.masterProfile?.admissionType ?? 'Unspecified',
    );
    const yearMap = this.countMap(
      rows,
      (r) => r.academicProfile?.admissionBatch?.entrySession?.name ?? 'Unknown',
    );

    return {
      title: 'Admission Summary',
      total,
      buckets: this.query.toBuckets(statusMap, total),
      crossTabs: [
        {
          label: 'Admission Type',
          buckets: this.query.toBuckets(typeMap, total),
        },
        {
          label: 'Academic Year',
          buckets: this.query.toBuckets(yearMap, total),
        },
      ],
    };
  }

  async getContactReport(
    tenantId: string,
    filters: StudentReportFiltersDto,
    user?: JwtUser,
  ): Promise<DistributionReport & { withMobile: number; withEmail: number }> {
    const rows = await this.loadStudents(tenantId, filters, user);
    const total = rows.length;
    let withMobile = 0;
    let withEmail = 0;

    for (const r of rows) {
      if (r.masterProfile?.mobileNumber) withMobile += 1;
      if (r.masterProfile?.email) withEmail += 1;
    }

    return {
      title: 'Contact Information Summary',
      total,
      withMobile,
      withEmail,
      buckets: [
        {
          key: 'mobile',
          label: 'With Mobile',
          count: withMobile,
          percentage: this.query.pct(withMobile, total),
        },
        {
          key: 'email',
          label: 'With Email',
          count: withEmail,
          percentage: this.query.pct(withEmail, total),
        },
        {
          key: 'missing',
          label: 'Missing Both',
          count:
            total -
            rows.filter(
              (r) => r.masterProfile?.mobileNumber || r.masterProfile?.email,
            ).length,
          percentage: this.query.pct(
            total -
              rows.filter(
                (r) => r.masterProfile?.mobileNumber || r.masterProfile?.email,
              ).length,
            total,
          ),
        },
      ],
    };
  }

  async getReportByType(
    tenantId: string,
    reportType: string,
    filters: StudentReportFiltersDto,
    user?: JwtUser,
  ) {
    switch (reportType) {
      case 'dashboard':
        return this.getDashboard(tenantId, filters, user);
      case 'strength':
        return this.getStrengthReport(tenantId, filters, user);
      case 'department':
        return this.getDepartmentStrength(tenantId, filters, user);
      case 'gender':
        return this.getGenderReport(tenantId, filters, user);
      case 'category':
        return this.getCategoryReport(tenantId, filters, user);
      case 'religion':
        return this.getReligionReport(tenantId, filters, user);
      case 'denomination':
        return this.getDenominationReport(tenantId, filters, user);
      case 'major-subjects':
        return this.getDepartmentSubjectsReport(tenantId, filters, user);
      case 'combinations':
        return this.getCombinationsReport(tenantId, filters, user);
      case 'mdc':
        return this.getNepBucketReport(tenantId, 'MDC', filters, user);
      case 'aec':
        return this.getNepBucketReport(tenantId, 'AEC', filters, user);
      case 'sec':
        return this.getNepBucketReport(tenantId, 'SEC', filters, user);
      case 'vac':
        return this.getNepBucketReport(tenantId, 'VAC', filters, user);
      case 'age':
        return this.getAgeReport(tenantId, filters, user);
      case 'blood-group':
        return this.getBloodGroupReport(tenantId, filters, user);
      case 'admission':
        return this.getAdmissionReport(tenantId, filters, user);
      case 'contact':
        return this.getContactReport(tenantId, filters, user);
      default:
        return this.getDashboard(tenantId, filters, user);
    }
  }

  private crossTabByGender(
    rows: StudentRow[],
    labelFn: (r: StudentRow) => string,
  ): ReportBucket[] {
    const map = new Map<string, number>();
    for (const r of rows) {
      const label = `${labelFn(r)} (${GENDER_LABELS[r.masterProfile?.gender ?? ''] ?? 'Other'})`;
      map.set(label, (map.get(label) ?? 0) + 1);
    }
    return this.query.toBuckets(map, rows.length);
  }

  private crossTabByDepartment(
    rows: StudentRow[],
    labelFn: (r: StudentRow) => string,
  ): ReportBucket[] {
    const map = new Map<string, number>();
    for (const r of rows) {
      const label = `${r.department?.name ?? 'Unassigned'} — ${labelFn(r)}`;
      map.set(label, (map.get(label) ?? 0) + 1);
    }
    return this.query.toBuckets(map, rows.length).slice(0, 20);
  }
}

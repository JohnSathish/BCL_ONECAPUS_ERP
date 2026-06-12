import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type {
  CreateMasterLookupDto,
  UpdateMasterLookupDto,
} from './dto/master-lookup.dto';

@Injectable()
export class MasterDataService {
  constructor(private readonly prisma: PrismaService) {}

  listGroupedTypes() {
    return [
      {
        category: 'General',
        types: [
          { code: 'RELIGION', label: 'Religion' },
          { code: 'CATEGORY', label: 'Category' },
          { code: 'TRIBE', label: 'Tribe' },
          { code: 'BLOOD_GROUP', label: 'Blood Group' },
          { code: 'OCCUPATION', label: 'Occupation' },
          { code: 'RELATION', label: 'Relation' },
          { code: 'LANGUAGE', label: 'Language' },
          { code: 'NATIONALITY', label: 'Nationality' },
        ],
      },
      {
        category: 'Academic',
        types: [
          { code: 'STREAM', label: 'Streams' },
          { code: 'SECTION', label: 'Sections' },
          { code: 'PROGRAMME_TYPE', label: 'Programme Types' },
          { code: 'ADMISSION_STATUS', label: 'Admission Status' },
        ],
      },
      {
        category: 'Communication',
        types: [
          { code: 'SMS_TEMPLATE', label: 'SMS Templates' },
          { code: 'EMAIL_TEMPLATE', label: 'Email Templates' },
          { code: 'NOTICE_CATEGORY', label: 'Notice Categories' },
        ],
      },
      {
        category: 'Geography',
        types: [
          { code: 'COUNTRY', label: 'Country' },
          { code: 'STATE', label: 'State' },
          { code: 'DISTRICT', label: 'District' },
          { code: 'CITY', label: 'City' },
        ],
      },
    ];
  }

  list(tenantId: string, lookupType?: string, activeOnly = true) {
    return this.prisma.masterLookup.findMany({
      where: {
        tenantId,
        ...(lookupType ? { lookupType } : {}),
        ...(activeOnly ? { isActive: true } : {}),
      },
      orderBy: [{ lookupType: 'asc' }, { sortOrder: 'asc' }, { label: 'asc' }],
    });
  }

  async create(tenantId: string, dto: CreateMasterLookupDto) {
    const existing = await this.prisma.masterLookup.findFirst({
      where: {
        tenantId,
        lookupType: dto.lookupType,
        code: dto.code,
      },
    });
    if (existing) {
      throw new ConflictException('Lookup code already exists for this type');
    }
    return this.prisma.masterLookup.create({
      data: {
        tenantId,
        lookupType: dto.lookupType,
        code: dto.code.trim().toUpperCase(),
        label: dto.label.trim(),
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
        metadata: dto.metadata as never,
        campusId: dto.campusId ?? null,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateMasterLookupDto) {
    const row = await this.prisma.masterLookup.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Lookup not found');
    return this.prisma.masterLookup.update({
      where: { id },
      data: {
        ...(dto.label !== undefined ? { label: dto.label.trim() } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.metadata !== undefined
          ? { metadata: dto.metadata as never }
          : {}),
        ...(dto.isActive === false ? { archivedAt: new Date() } : {}),
        ...(dto.isActive === true ? { archivedAt: null } : {}),
      },
    });
  }

  async reorder(tenantId: string, lookupType: string, ids: string[]) {
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.masterLookup.updateMany({
          where: { id, tenantId, lookupType },
          data: { sortOrder: index },
        }),
      ),
    );
    return { success: true };
  }

  async seedDefaults(tenantId: string) {
    const defaults: {
      lookupType: string;
      code: string;
      label: string;
      sortOrder: number;
    }[] = [
      {
        lookupType: 'CATEGORY',
        code: 'GENERAL',
        label: 'General',
        sortOrder: 1,
      },
      { lookupType: 'CATEGORY', code: 'OBC', label: 'OBC', sortOrder: 2 },
      { lookupType: 'CATEGORY', code: 'SC', label: 'SC', sortOrder: 3 },
      { lookupType: 'CATEGORY', code: 'ST', label: 'ST', sortOrder: 4 },
      { lookupType: 'RELIGION', code: 'HINDU', label: 'Hindu', sortOrder: 1 },
      { lookupType: 'RELIGION', code: 'MUSLIM', label: 'Muslim', sortOrder: 2 },
      {
        lookupType: 'RELIGION',
        code: 'CHRISTIAN',
        label: 'Christian',
        sortOrder: 3,
      },
      { lookupType: 'RELIGION', code: 'OTHER', label: 'Other', sortOrder: 4 },
      { lookupType: 'BLOOD_GROUP', code: 'A_POS', label: 'A+', sortOrder: 1 },
      { lookupType: 'BLOOD_GROUP', code: 'B_POS', label: 'B+', sortOrder: 2 },
      { lookupType: 'BLOOD_GROUP', code: 'O_POS', label: 'O+', sortOrder: 3 },
      { lookupType: 'BLOOD_GROUP', code: 'AB_POS', label: 'AB+', sortOrder: 4 },
      { lookupType: 'NATIONALITY', code: 'IN', label: 'Indian', sortOrder: 1 },
      {
        lookupType: 'ADMISSION_STATUS',
        code: 'ACTIVE',
        label: 'Active',
        sortOrder: 1,
      },
      {
        lookupType: 'ADMISSION_STATUS',
        code: 'PENDING',
        label: 'Pending',
        sortOrder: 2,
      },
      {
        lookupType: 'ADMISSION_STATUS',
        code: 'CANCELLED',
        label: 'Cancelled',
        sortOrder: 3,
      },
      { lookupType: 'TRIBE', code: 'GARO', label: 'Garo', sortOrder: 1 },
      {
        lookupType: 'OCCUPATION',
        code: 'FARMER',
        label: 'Farmer',
        sortOrder: 1,
      },
      { lookupType: 'RELATION', code: 'FATHER', label: 'Father', sortOrder: 1 },
      { lookupType: 'RELATION', code: 'MOTHER', label: 'Mother', sortOrder: 2 },
      { lookupType: 'LANGUAGE', code: 'EN', label: 'English', sortOrder: 1 },
      { lookupType: 'STREAM', code: 'ARTS', label: 'Arts', sortOrder: 1 },
      { lookupType: 'STREAM', code: 'SCIENCE', label: 'Science', sortOrder: 2 },
      { lookupType: 'SECTION', code: 'A', label: 'Section A', sortOrder: 1 },
      {
        lookupType: 'PROGRAMME_TYPE',
        code: 'UG',
        label: 'Undergraduate',
        sortOrder: 1,
      },
      {
        lookupType: 'PROGRAMME_TYPE',
        code: 'PG',
        label: 'Postgraduate',
        sortOrder: 2,
      },
      {
        lookupType: 'PROGRAMME_TYPE',
        code: 'DIPLOMA',
        label: 'Diploma',
        sortOrder: 3,
      },
      {
        lookupType: 'PROGRAMME_TYPE',
        code: 'CERTIFICATE',
        label: 'Certificate',
        sortOrder: 4,
      },
      {
        lookupType: 'PROGRAMME_MODE',
        code: 'REGULAR',
        label: 'Regular',
        sortOrder: 1,
      },
      {
        lookupType: 'PROGRAMME_MODE',
        code: 'DISTANCE',
        label: 'Distance',
        sortOrder: 2,
      },
      {
        lookupType: 'PROGRAMME_MODE',
        code: 'ONLINE',
        label: 'Online',
        sortOrder: 3,
      },
      ...Array.from({ length: 8 }, (_, i) => ({
        lookupType: 'SEMESTER',
        code: `SEM_${i + 1}`,
        label: `Semester ${i + 1}`,
        sortOrder: i + 1,
      })),
      {
        lookupType: 'ACADEMIC_STATUS',
        code: 'STUDYING',
        label: 'Studying',
        sortOrder: 1,
      },
      {
        lookupType: 'ACADEMIC_STATUS',
        code: 'PASSED',
        label: 'Passed',
        sortOrder: 2,
      },
      {
        lookupType: 'ACADEMIC_STATUS',
        code: 'DROPPED',
        label: 'Dropped',
        sortOrder: 3,
      },
      {
        lookupType: 'ACADEMIC_STATUS',
        code: 'SUSPENDED',
        label: 'Suspended',
        sortOrder: 4,
      },
      {
        lookupType: 'ACADEMIC_STATUS',
        code: 'ALUMNI',
        label: 'Alumni',
        sortOrder: 5,
      },
      {
        lookupType: 'ADMISSION_TYPE',
        code: 'REGULAR',
        label: 'Regular',
        sortOrder: 1,
      },
      {
        lookupType: 'ADMISSION_TYPE',
        code: 'MANAGEMENT',
        label: 'Management',
        sortOrder: 2,
      },
      {
        lookupType: 'ADMISSION_TYPE',
        code: 'LATERAL',
        label: 'Lateral Entry',
        sortOrder: 3,
      },
      {
        lookupType: 'ADMISSION_TYPE',
        code: 'TRANSFER',
        label: 'Transfer',
        sortOrder: 4,
      },
      {
        lookupType: 'NEP_CATEGORY',
        code: 'MAJOR',
        label: 'Major',
        sortOrder: 1,
      },
      {
        lookupType: 'NEP_CATEGORY',
        code: 'MINOR',
        label: 'Minor',
        sortOrder: 2,
      },
      { lookupType: 'NEP_CATEGORY', code: 'MDC', label: 'MDC', sortOrder: 3 },
      { lookupType: 'NEP_CATEGORY', code: 'AEC', label: 'AEC', sortOrder: 4 },
      { lookupType: 'NEP_CATEGORY', code: 'SEC', label: 'SEC', sortOrder: 5 },
      { lookupType: 'NEP_CATEGORY', code: 'VAC', label: 'VAC', sortOrder: 6 },
      { lookupType: 'NEP_CATEGORY', code: 'VTC', label: 'VTC', sortOrder: 7 },
      {
        lookupType: 'STAFF_TYPE',
        code: 'TEACHING',
        label: 'Teaching',
        sortOrder: 1,
      },
      {
        lookupType: 'STAFF_TYPE',
        code: 'NON_TEACHING',
        label: 'Non Teaching',
        sortOrder: 2,
      },
      {
        lookupType: 'STAFF_TYPE',
        code: 'ADMIN',
        label: 'Administrative',
        sortOrder: 3,
      },
      {
        lookupType: 'STAFF_TYPE',
        code: 'GUEST',
        label: 'Guest Faculty',
        sortOrder: 4,
      },
      {
        lookupType: 'STAFF_TYPE',
        code: 'VISITING',
        label: 'Visiting Faculty',
        sortOrder: 5,
      },
      {
        lookupType: 'STAFF_TYPE',
        code: 'CONTRACT',
        label: 'Contract Staff',
        sortOrder: 6,
      },
      {
        lookupType: 'EMPLOYMENT_TYPE',
        code: 'PERMANENT',
        label: 'Permanent',
        sortOrder: 1,
      },
      {
        lookupType: 'EMPLOYMENT_TYPE',
        code: 'CONTRACT',
        label: 'Contract',
        sortOrder: 2,
      },
      {
        lookupType: 'EMPLOYMENT_TYPE',
        code: 'GUEST',
        label: 'Guest',
        sortOrder: 3,
      },
      {
        lookupType: 'EMPLOYMENT_TYPE',
        code: 'VISITING',
        label: 'Visiting',
        sortOrder: 4,
      },
      {
        lookupType: 'STAFF_STATUS',
        code: 'ACTIVE',
        label: 'Active',
        sortOrder: 1,
      },
      {
        lookupType: 'STAFF_STATUS',
        code: 'ON_LEAVE',
        label: 'On Leave',
        sortOrder: 2,
      },
      {
        lookupType: 'STAFF_STATUS',
        code: 'RETIRED',
        label: 'Retired',
        sortOrder: 3,
      },
      {
        lookupType: 'STAFF_STATUS',
        code: 'RELIEVED',
        label: 'Relieved',
        sortOrder: 4,
      },
      {
        lookupType: 'STAFF_STATUS',
        code: 'SUSPENDED',
        label: 'Suspended',
        sortOrder: 5,
      },
      {
        lookupType: 'QUALIFICATION_TYPE',
        code: 'PHD',
        label: 'PhD',
        sortOrder: 1,
      },
      {
        lookupType: 'QUALIFICATION_TYPE',
        code: 'NET',
        label: 'NET',
        sortOrder: 2,
      },
      {
        lookupType: 'QUALIFICATION_TYPE',
        code: 'MPHIL',
        label: 'MPhil',
        sortOrder: 3,
      },
      {
        lookupType: 'QUALIFICATION_TYPE',
        code: 'MSC',
        label: 'MSc',
        sortOrder: 4,
      },
      {
        lookupType: 'QUALIFICATION_TYPE',
        code: 'MA',
        label: 'MA',
        sortOrder: 5,
      },
      {
        lookupType: 'STUDENT_STATUS',
        code: 'STUDYING',
        label: 'Studying',
        sortOrder: 1,
      },
      {
        lookupType: 'STUDENT_STATUS',
        code: 'ALUMNI',
        label: 'Alumni',
        sortOrder: 2,
      },
      {
        lookupType: 'STUDENT_STATUS',
        code: 'DROPOUT',
        label: 'Dropout',
        sortOrder: 3,
      },
      {
        lookupType: 'STUDENT_STATUS',
        code: 'SUSPENDED',
        label: 'Suspended',
        sortOrder: 4,
      },
      { lookupType: 'GENDER', code: 'MALE', label: 'Male', sortOrder: 1 },
      { lookupType: 'GENDER', code: 'FEMALE', label: 'Female', sortOrder: 2 },
      { lookupType: 'GENDER', code: 'OTHER', label: 'Other', sortOrder: 3 },
      {
        lookupType: 'MOTHER_TONGUE',
        code: 'EN',
        label: 'English',
        sortOrder: 1,
      },
      { lookupType: 'MOTHER_TONGUE', code: 'HI', label: 'Hindi', sortOrder: 2 },
      { lookupType: 'MOTHER_TONGUE', code: 'GAR', label: 'Garo', sortOrder: 3 },
      { lookupType: 'BOARD_NAME', code: 'MBOSE', label: 'MBOSE', sortOrder: 1 },
      { lookupType: 'BOARD_NAME', code: 'CBSE', label: 'CBSE', sortOrder: 2 },
      { lookupType: 'BOARD_NAME', code: 'ICSE', label: 'ICSE', sortOrder: 3 },
      {
        lookupType: 'DISABILITY_TYPE',
        code: 'NONE',
        label: 'None',
        sortOrder: 1,
      },
      {
        lookupType: 'DISABILITY_TYPE',
        code: 'VISUAL',
        label: 'Visual',
        sortOrder: 2,
      },
      {
        lookupType: 'DISABILITY_TYPE',
        code: 'HEARING',
        label: 'Hearing',
        sortOrder: 3,
      },
      {
        lookupType: 'DISABILITY_TYPE',
        code: 'LOCOMOTOR',
        label: 'Locomotor',
        sortOrder: 4,
      },
      {
        lookupType: 'DENOMINATION',
        code: 'CATHOLIC',
        label: 'Catholic',
        sortOrder: 1,
      },
      {
        lookupType: 'DENOMINATION',
        code: 'PROTESTANT',
        label: 'Protestant',
        sortOrder: 2,
      },
      {
        lookupType: 'DENOMINATION',
        code: 'OTHER',
        label: 'Other',
        sortOrder: 3,
      },
      { lookupType: 'COUNTRY', code: 'IN', label: 'India', sortOrder: 1 },
      { lookupType: 'STATE', code: 'ML', label: 'Meghalaya', sortOrder: 1 },
    ];

    for (const d of defaults) {
      await this.prisma.masterLookup.upsert({
        where: {
          tenantId_lookupType_code: {
            tenantId,
            lookupType: d.lookupType,
            code: d.code,
          },
        },
        create: { tenantId, ...d },
        update: { label: d.label, sortOrder: d.sortOrder, isActive: true },
      });
    }
  }
}

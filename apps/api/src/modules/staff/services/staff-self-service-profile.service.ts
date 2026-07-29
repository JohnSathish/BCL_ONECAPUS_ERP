import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { StaffPortalService } from './staff-portal.service';

const APPROVAL = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

function monthsBetween(from: Date, to: Date | null | undefined): number {
  const end = to ?? new Date();
  const months =
    (end.getFullYear() - from.getFullYear()) * 12 +
    (end.getMonth() - from.getMonth());
  return Math.max(0, months);
}

@Injectable()
export class StaffSelfServiceProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly portal: StaffPortalService,
  ) {}

  private async staffOf(user: JwtUser) {
    return this.portal.resolveStaffProfile(user.tid, user.sub);
  }

  private async audit(
    tenantId: string,
    staffProfileId: string,
    actorUserId: string | undefined,
    action: string,
    section: string,
    summary: string,
    meta?: Record<string, unknown>,
  ) {
    await this.prisma.staffProfileAuditLog.create({
      data: {
        tenantId,
        staffProfileId,
        actorUserId: actorUserId ?? null,
        action,
        section,
        summary,
        metaJson: (meta ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async getExtendedMe(user: JwtUser) {
    const base = await this.portal.getMe(user);
    const staff = await this.prisma.staffProfile.findFirst({
      where: { id: base.id, tenantId: user.tid },
      select: {
        gender: true,
        dateOfBirth: true,
        aadhaarNo: true,
        panNo: true,
        passportNo: true,
        maritalStatus: true,
        nationality: true,
        religion: true,
        alternateMobile: true,
        personalEmail: true,
        bankName: true,
        accountHolderName: true,
        accountNumber: true,
        ifsc: true,
        bankBranch: true,
        upiId: true,
        updatedAt: true,
        bloodGroupLookupId: true,
      },
    });
    let bloodGroup: string | null = null;
    if (staff?.bloodGroupLookupId) {
      const lookup = await this.prisma.masterLookup.findFirst({
        where: { id: staff.bloodGroupLookupId, tenantId: user.tid },
        select: { label: true },
      });
      bloodGroup = lookup?.label ?? null;
    }
    return {
      ...base,
      gender: staff?.gender ?? null,
      dateOfBirth: staff?.dateOfBirth ?? null,
      aadhaarNo: staff?.aadhaarNo ?? null,
      panNo: staff?.panNo ?? null,
      passportNo: staff?.passportNo ?? null,
      maritalStatus: staff?.maritalStatus ?? null,
      nationality: staff?.nationality ?? null,
      religion: staff?.religion ?? null,
      alternateMobile: staff?.alternateMobile ?? null,
      personalEmail: staff?.personalEmail ?? null,
      bloodGroup,
      bank: {
        accountHolderName: staff?.accountHolderName ?? null,
        bankName: staff?.bankName ?? null,
        branch: staff?.bankBranch ?? null,
        accountNumber: staff?.accountNumber ?? null,
        ifsc: staff?.ifsc ?? null,
        upiId: staff?.upiId ?? null,
      },
      lastUpdatedAt: staff?.updatedAt ?? null,
    };
  }

  async updatePersonal(
    user: JwtUser,
    dto: {
      fullName?: string;
      gender?: string;
      dateOfBirth?: string;
      bloodGroupLookupId?: string | null;
      maritalStatus?: string;
      nationality?: string;
      religion?: string;
      aadhaarNo?: string;
      panNo?: string;
      passportNo?: string;
      mobile?: string;
      publicEmail?: string;
      publicPhone?: string;
      officeLocation?: string;
      googleScholarUrl?: string;
      orcidUrl?: string;
      researchAreas?: string;
    },
  ) {
    const staff = await this.staffOf(user);
    await this.prisma.staffProfile.update({
      where: { id: staff.id },
      data: {
        ...(dto.fullName !== undefined
          ? { fullName: dto.fullName.trim() }
          : {}),
        ...(dto.gender !== undefined ? { gender: dto.gender || null } : {}),
        ...(dto.dateOfBirth !== undefined
          ? {
              dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
            }
          : {}),
        ...(dto.bloodGroupLookupId !== undefined
          ? { bloodGroupLookupId: dto.bloodGroupLookupId }
          : {}),
        ...(dto.maritalStatus !== undefined
          ? { maritalStatus: dto.maritalStatus || null }
          : {}),
        ...(dto.nationality !== undefined
          ? { nationality: dto.nationality || null }
          : {}),
        ...(dto.religion !== undefined
          ? { religion: dto.religion || null }
          : {}),
        ...(dto.aadhaarNo !== undefined
          ? { aadhaarNo: dto.aadhaarNo || null }
          : {}),
        ...(dto.panNo !== undefined ? { panNo: dto.panNo || null } : {}),
        ...(dto.passportNo !== undefined
          ? { passportNo: dto.passportNo || null }
          : {}),
        ...(dto.mobile !== undefined ? { mobile: dto.mobile || null } : {}),
        ...(dto.publicEmail !== undefined
          ? { publicEmail: dto.publicEmail || null }
          : {}),
        ...(dto.publicPhone !== undefined
          ? { publicPhone: dto.publicPhone || null }
          : {}),
        ...(dto.officeLocation !== undefined
          ? { officeLocation: dto.officeLocation || null }
          : {}),
        ...(dto.googleScholarUrl !== undefined
          ? { googleScholarUrl: dto.googleScholarUrl || null }
          : {}),
        ...(dto.orcidUrl !== undefined
          ? { orcidUrl: dto.orcidUrl || null }
          : {}),
        ...(dto.researchAreas !== undefined
          ? { researchAreas: dto.researchAreas || null }
          : {}),
      },
    });
    await this.audit(
      user.tid,
      staff.id,
      user.sub,
      'PROFILE_UPDATED',
      'personal',
      'Personal details updated',
    );
    return this.getExtendedMe(user);
  }

  async updateContact(
    user: JwtUser,
    dto: {
      mobile?: string;
      alternateMobile?: string;
      personalEmail?: string;
      addressJson?: Record<string, unknown>;
    },
  ) {
    const staff = await this.staffOf(user);
    await this.prisma.staffProfile.update({
      where: { id: staff.id },
      data: {
        ...(dto.mobile !== undefined ? { mobile: dto.mobile || null } : {}),
        ...(dto.alternateMobile !== undefined
          ? { alternateMobile: dto.alternateMobile || null }
          : {}),
        ...(dto.personalEmail !== undefined
          ? { personalEmail: dto.personalEmail || null }
          : {}),
        ...(dto.addressJson !== undefined
          ? { addressJson: dto.addressJson as Prisma.InputJsonValue }
          : {}),
      },
    });
    await this.audit(
      user.tid,
      staff.id,
      user.sub,
      'ADDRESS_UPDATED',
      'contact',
      'Contact details updated',
    );
    return this.getExtendedMe(user);
  }

  async updateBank(
    user: JwtUser,
    dto: {
      accountHolderName?: string;
      bankName?: string;
      bankBranch?: string;
      accountNumber?: string;
      ifsc?: string;
      upiId?: string;
    },
  ) {
    const staff = await this.staffOf(user);
    await this.prisma.staffProfile.update({
      where: { id: staff.id },
      data: {
        ...(dto.accountHolderName !== undefined
          ? { accountHolderName: dto.accountHolderName || null }
          : {}),
        ...(dto.bankName !== undefined
          ? { bankName: dto.bankName || null }
          : {}),
        ...(dto.bankBranch !== undefined
          ? { bankBranch: dto.bankBranch || null }
          : {}),
        ...(dto.accountNumber !== undefined
          ? { accountNumber: dto.accountNumber || null }
          : {}),
        ...(dto.ifsc !== undefined ? { ifsc: dto.ifsc || null } : {}),
        ...(dto.upiId !== undefined ? { upiId: dto.upiId || null } : {}),
      },
    });
    await this.audit(
      user.tid,
      staff.id,
      user.sub,
      'PROFILE_UPDATED',
      'bank',
      'Bank details updated',
    );
    return this.getExtendedMe(user);
  }

  /* ─── Emergency contacts ─── */

  async listEmergencyContacts(user: JwtUser) {
    const staff = await this.staffOf(user);
    return this.prisma.staffEmergencyContact.findMany({
      where: { tenantId: user.tid, staffProfileId: staff.id },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createEmergencyContact(
    user: JwtUser,
    dto: {
      contactName: string;
      relationship: string;
      mobile: string;
      alternateMobile?: string;
      address?: string;
    },
  ) {
    const staff = await this.staffOf(user);
    const row = await this.prisma.staffEmergencyContact.create({
      data: {
        tenantId: user.tid,
        staffProfileId: staff.id,
        contactName: dto.contactName.trim(),
        relationship: dto.relationship.trim(),
        mobile: dto.mobile.trim(),
        alternateMobile: dto.alternateMobile?.trim() || null,
        address: dto.address?.trim() || null,
      },
    });
    await this.audit(
      user.tid,
      staff.id,
      user.sub,
      'PROFILE_UPDATED',
      'emergency',
      `Emergency contact added: ${row.contactName}`,
    );
    return row;
  }

  async updateEmergencyContact(
    user: JwtUser,
    id: string,
    dto: Partial<{
      contactName: string;
      relationship: string;
      mobile: string;
      alternateMobile: string;
      address: string;
    }>,
  ) {
    const staff = await this.staffOf(user);
    const existing = await this.prisma.staffEmergencyContact.findFirst({
      where: { id, tenantId: user.tid, staffProfileId: staff.id },
    });
    if (!existing) throw new NotFoundException('Emergency contact not found');
    return this.prisma.staffEmergencyContact.update({
      where: { id },
      data: {
        ...(dto.contactName !== undefined
          ? { contactName: dto.contactName.trim() }
          : {}),
        ...(dto.relationship !== undefined
          ? { relationship: dto.relationship.trim() }
          : {}),
        ...(dto.mobile !== undefined ? { mobile: dto.mobile.trim() } : {}),
        ...(dto.alternateMobile !== undefined
          ? { alternateMobile: dto.alternateMobile || null }
          : {}),
        ...(dto.address !== undefined ? { address: dto.address || null } : {}),
      },
    });
  }

  async deleteEmergencyContact(user: JwtUser, id: string) {
    const staff = await this.staffOf(user);
    const existing = await this.prisma.staffEmergencyContact.findFirst({
      where: { id, tenantId: user.tid, staffProfileId: staff.id },
    });
    if (!existing) throw new NotFoundException('Emergency contact not found');
    await this.prisma.staffEmergencyContact.delete({ where: { id } });
    return { ok: true };
  }

  /* ─── Qualifications (approval gated) ─── */

  async listQualifications(user: JwtUser) {
    const staff = await this.staffOf(user);
    return this.prisma.staffQualification.findMany({
      where: { tenantId: user.tid, staffProfileId: staff.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createQualification(
    user: JwtUser,
    dto: {
      qualification: string;
      specialization?: string;
      institution?: string;
      university?: string;
      board?: string;
      passingYear?: number;
      percentageOrCgpa?: string;
      division?: string;
      certificateUrl?: string;
    },
  ) {
    const staff = await this.staffOf(user);
    const row = await this.prisma.staffQualification.create({
      data: {
        tenantId: user.tid,
        staffProfileId: staff.id,
        qualification: dto.qualification.trim(),
        specialization: dto.specialization?.trim() || null,
        institution: dto.institution?.trim() || null,
        university: dto.university?.trim() || null,
        board: dto.board?.trim() || null,
        passingYear: dto.passingYear ?? null,
        percentageOrCgpa: dto.percentageOrCgpa?.trim() || null,
        division: dto.division?.trim() || null,
        certificateUrl: dto.certificateUrl?.trim() || null,
        approvalStatus: APPROVAL.PENDING,
        submittedAt: new Date(),
      },
    });
    await this.audit(
      user.tid,
      staff.id,
      user.sub,
      'QUALIFICATION_ADDED',
      'qualifications',
      `Qualification submitted: ${row.qualification}`,
      { id: row.id },
    );
    return row;
  }

  async updateQualification(
    user: JwtUser,
    id: string,
    dto: Partial<{
      qualification: string;
      specialization: string;
      institution: string;
      university: string;
      board: string;
      passingYear: number;
      percentageOrCgpa: string;
      division: string;
      certificateUrl: string;
    }>,
  ) {
    const staff = await this.staffOf(user);
    const existing = await this.prisma.staffQualification.findFirst({
      where: { id, tenantId: user.tid, staffProfileId: staff.id },
    });
    if (!existing) throw new NotFoundException('Qualification not found');
    return this.prisma.staffQualification.update({
      where: { id },
      data: {
        ...(dto.qualification !== undefined
          ? { qualification: dto.qualification.trim() }
          : {}),
        ...(dto.specialization !== undefined
          ? { specialization: dto.specialization || null }
          : {}),
        ...(dto.institution !== undefined
          ? { institution: dto.institution || null }
          : {}),
        ...(dto.university !== undefined
          ? { university: dto.university || null }
          : {}),
        ...(dto.board !== undefined ? { board: dto.board || null } : {}),
        ...(dto.passingYear !== undefined
          ? { passingYear: dto.passingYear }
          : {}),
        ...(dto.percentageOrCgpa !== undefined
          ? { percentageOrCgpa: dto.percentageOrCgpa || null }
          : {}),
        ...(dto.division !== undefined
          ? { division: dto.division || null }
          : {}),
        ...(dto.certificateUrl !== undefined
          ? { certificateUrl: dto.certificateUrl || null }
          : {}),
        approvalStatus: APPROVAL.PENDING,
        submittedAt: new Date(),
        reviewRemarks: null,
        reviewedAt: null,
        reviewedById: null,
      },
    });
  }

  async deleteQualification(user: JwtUser, id: string) {
    const staff = await this.staffOf(user);
    const existing = await this.prisma.staffQualification.findFirst({
      where: { id, tenantId: user.tid, staffProfileId: staff.id },
    });
    if (!existing) throw new NotFoundException('Qualification not found');
    if (existing.approvalStatus === APPROVAL.APPROVED) {
      throw new BadRequestException(
        'Approved qualifications cannot be deleted. Contact HR.',
      );
    }
    await this.prisma.staffQualification.delete({ where: { id } });
    return { ok: true };
  }

  /* ─── Experience ─── */

  async listExperience(user: JwtUser) {
    const staff = await this.staffOf(user);
    const items = await this.prisma.staffExperience.findMany({
      where: { tenantId: user.tid, staffProfileId: staff.id },
      orderBy: { fromDate: 'desc' },
    });
    const approvedMonths = items
      .filter((i) => i.approvalStatus === APPROVAL.APPROVED)
      .reduce(
        (sum, i) =>
          sum + (i.totalMonths ?? monthsBetween(i.fromDate, i.toDate)),
        0,
      );
    return {
      items,
      totalTeachingMonths: approvedMonths,
      totalTeachingYears: Math.round((approvedMonths / 12) * 10) / 10,
    };
  }

  async createExperience(
    user: JwtUser,
    dto: {
      institutionName: string;
      designation: string;
      department?: string;
      employmentType?: string;
      fromDate: string;
      toDate?: string;
      certificateUrl?: string;
    },
  ) {
    const staff = await this.staffOf(user);
    const fromDate = new Date(dto.fromDate);
    const toDate = dto.toDate ? new Date(dto.toDate) : null;
    const row = await this.prisma.staffExperience.create({
      data: {
        tenantId: user.tid,
        staffProfileId: staff.id,
        institutionName: dto.institutionName.trim(),
        designation: dto.designation.trim(),
        department: dto.department?.trim() || null,
        employmentType: dto.employmentType?.trim() || null,
        fromDate,
        toDate,
        totalMonths: monthsBetween(fromDate, toDate),
        certificateUrl: dto.certificateUrl?.trim() || null,
        approvalStatus: APPROVAL.PENDING,
        submittedAt: new Date(),
      },
    });
    await this.audit(
      user.tid,
      staff.id,
      user.sub,
      'PROFILE_UPDATED',
      'experience',
      `Experience submitted: ${row.institutionName}`,
      { id: row.id },
    );
    return row;
  }

  async updateExperience(
    user: JwtUser,
    id: string,
    dto: Partial<{
      institutionName: string;
      designation: string;
      department: string;
      employmentType: string;
      fromDate: string;
      toDate: string | null;
      certificateUrl: string;
    }>,
  ) {
    const staff = await this.staffOf(user);
    const existing = await this.prisma.staffExperience.findFirst({
      where: { id, tenantId: user.tid, staffProfileId: staff.id },
    });
    if (!existing) throw new NotFoundException('Experience not found');
    const fromDate = dto.fromDate ? new Date(dto.fromDate) : existing.fromDate;
    const toDate =
      dto.toDate === undefined
        ? existing.toDate
        : dto.toDate
          ? new Date(dto.toDate)
          : null;
    return this.prisma.staffExperience.update({
      where: { id },
      data: {
        ...(dto.institutionName !== undefined
          ? { institutionName: dto.institutionName.trim() }
          : {}),
        ...(dto.designation !== undefined
          ? { designation: dto.designation.trim() }
          : {}),
        ...(dto.department !== undefined
          ? { department: dto.department || null }
          : {}),
        ...(dto.employmentType !== undefined
          ? { employmentType: dto.employmentType || null }
          : {}),
        fromDate,
        toDate,
        totalMonths: monthsBetween(fromDate, toDate),
        ...(dto.certificateUrl !== undefined
          ? { certificateUrl: dto.certificateUrl || null }
          : {}),
        approvalStatus: APPROVAL.PENDING,
        submittedAt: new Date(),
        reviewRemarks: null,
        reviewedAt: null,
        reviewedById: null,
      },
    });
  }

  async deleteExperience(user: JwtUser, id: string) {
    const staff = await this.staffOf(user);
    const existing = await this.prisma.staffExperience.findFirst({
      where: { id, tenantId: user.tid, staffProfileId: staff.id },
    });
    if (!existing) throw new NotFoundException('Experience not found');
    if (existing.approvalStatus === APPROVAL.APPROVED) {
      throw new BadRequestException(
        'Approved experience cannot be deleted. Contact HR.',
      );
    }
    await this.prisma.staffExperience.delete({ where: { id } });
    return { ok: true };
  }

  /* ─── Certifications ─── */

  async listCertifications(user: JwtUser) {
    const staff = await this.staffOf(user);
    return this.prisma.staffCertification.findMany({
      where: { tenantId: user.tid, staffProfileId: staff.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCertification(
    user: JwtUser,
    dto: {
      certificationType: string;
      title: string;
      organizer?: string;
      year?: number;
      certificateUrl?: string;
    },
  ) {
    const staff = await this.staffOf(user);
    const row = await this.prisma.staffCertification.create({
      data: {
        tenantId: user.tid,
        staffProfileId: staff.id,
        certificationType: dto.certificationType.trim(),
        title: dto.title.trim(),
        organizer: dto.organizer?.trim() || null,
        year: dto.year ?? null,
        certificateUrl: dto.certificateUrl?.trim() || null,
        approvalStatus: APPROVAL.PENDING,
        submittedAt: new Date(),
      },
    });
    await this.audit(
      user.tid,
      staff.id,
      user.sub,
      'DOCUMENT_UPLOADED',
      'certifications',
      `Certification submitted: ${row.title}`,
      { id: row.id },
    );
    return row;
  }

  async updateCertification(
    user: JwtUser,
    id: string,
    dto: Partial<{
      certificationType: string;
      title: string;
      organizer: string;
      year: number;
      certificateUrl: string;
    }>,
  ) {
    const staff = await this.staffOf(user);
    const existing = await this.prisma.staffCertification.findFirst({
      where: { id, tenantId: user.tid, staffProfileId: staff.id },
    });
    if (!existing) throw new NotFoundException('Certification not found');
    return this.prisma.staffCertification.update({
      where: { id },
      data: {
        ...(dto.certificationType !== undefined
          ? { certificationType: dto.certificationType.trim() }
          : {}),
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.organizer !== undefined
          ? { organizer: dto.organizer || null }
          : {}),
        ...(dto.year !== undefined ? { year: dto.year } : {}),
        ...(dto.certificateUrl !== undefined
          ? { certificateUrl: dto.certificateUrl || null }
          : {}),
        approvalStatus: APPROVAL.PENDING,
        submittedAt: new Date(),
        reviewRemarks: null,
        reviewedAt: null,
        reviewedById: null,
      },
    });
  }

  async deleteCertification(user: JwtUser, id: string) {
    const staff = await this.staffOf(user);
    const existing = await this.prisma.staffCertification.findFirst({
      where: { id, tenantId: user.tid, staffProfileId: staff.id },
    });
    if (!existing) throw new NotFoundException('Certification not found');
    if (existing.approvalStatus === APPROVAL.APPROVED) {
      throw new BadRequestException(
        'Approved certifications cannot be deleted. Contact HR.',
      );
    }
    await this.prisma.staffCertification.delete({ where: { id } });
    return { ok: true };
  }

  async getHistory(user: JwtUser, take = 50) {
    const staff = await this.staffOf(user);
    return this.prisma.staffProfileAuditLog.findMany({
      where: { tenantId: user.tid, staffProfileId: staff.id },
      orderBy: { createdAt: 'desc' },
      take: Math.min(take, 100),
    });
  }

  async submitForReview(user: JwtUser) {
    const staff = await this.staffOf(user);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.staffQualification.updateMany({
        where: {
          tenantId: user.tid,
          staffProfileId: staff.id,
          approvalStatus: APPROVAL.PENDING,
        },
        data: { submittedAt: now },
      }),
      this.prisma.staffExperience.updateMany({
        where: {
          tenantId: user.tid,
          staffProfileId: staff.id,
          approvalStatus: APPROVAL.PENDING,
        },
        data: { submittedAt: now },
      }),
      this.prisma.staffCertification.updateMany({
        where: {
          tenantId: user.tid,
          staffProfileId: staff.id,
          approvalStatus: APPROVAL.PENDING,
        },
        data: { submittedAt: now },
      }),
    ]);
    await this.audit(
      user.tid,
      staff.id,
      user.sub,
      'PROFILE_UPDATED',
      'submit',
      'Profile update request submitted for HR review',
    );
    return { ok: true, message: 'Submitted for HR review' };
  }

  async logDocumentUpload(user: JwtUser, documentType: string, docId: string) {
    const staff = await this.staffOf(user);
    await this.audit(
      user.tid,
      staff.id,
      user.sub,
      'DOCUMENT_UPLOADED',
      'documents',
      `Document uploaded: ${documentType}`,
      { id: docId, documentType },
    );
  }
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';

export type AlumniRegisterDto = {
  fullName: string;
  gender?: string;
  dateOfBirth?: string;
  bloodGroup?: string;
  photoUrl?: string;
  graduationYear?: number;
  programme?: string;
  department?: string;
  collegeRollNumber?: string;
  universityRegNumber?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  currentAddress?: string;
  state?: string;
  country?: string;
  pinCode?: string;
  employmentStatus?: string;
  occupation?: string;
  currentOrg?: string;
  currentRole?: string;
  officeAddress?: string;
  linkedinUrl?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  websiteUrl?: string;
  emergencyName?: string;
  emergencyMobile?: string;
  emergencyRelation?: string;
  membershipTypeId?: string;
  mentorshipOptIn?: boolean;
  agreeCommunications?: boolean;
  certifyTrue?: boolean;
};

@Injectable()
export class AlumniService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeHeroImages(
    heroImagesJson: unknown,
    heroImageUrl?: string | null,
  ): string[] {
    if (Array.isArray(heroImagesJson) && heroImagesJson.length > 0) {
      return heroImagesJson
        .map((value: unknown) =>
          typeof value === 'string' ? value.trim() : '',
        )
        .filter(Boolean);
    }
    if (heroImageUrl?.trim()) return [heroImageUrl.trim()];
    return ['/branding/alumni-campus-hero.png'];
  }

  list(
    tenantId: string,
    query: { graduationYear?: number; q?: string; status?: string } = {},
  ) {
    return this.prisma.alumniProfile.findMany({
      where: {
        tenantId,
        ...(query.graduationYear
          ? { graduationYear: query.graduationYear }
          : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.q?.trim()
          ? {
              OR: [
                { fullName: { contains: query.q.trim(), mode: 'insensitive' } },
                { email: { contains: query.q.trim(), mode: 'insensitive' } },
                {
                  currentOrg: { contains: query.q.trim(), mode: 'insensitive' },
                },
                {
                  membershipNumber: {
                    contains: query.q.trim(),
                    mode: 'insensitive',
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        memberships: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: { membershipType: true },
        },
      },
      orderBy: { fullName: 'asc' },
      take: 300,
    });
  }

  get(tenantId: string, id: string) {
    return this.prisma.alumniProfile.findFirst({
      where: { id, tenantId },
      include: {
        memberships: {
          orderBy: { createdAt: 'desc' },
          include: { membershipType: true },
        },
        payments: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
  }

  create(
    user: JwtUser,
    dto: {
      studentId?: string;
      userId?: string;
      fullName: string;
      graduationYear?: number;
      programme?: string;
      email?: string;
      phone?: string;
      currentOrg?: string;
      currentRole?: string;
      mentorshipOptIn?: boolean;
    },
  ) {
    return this.prisma.alumniProfile.create({
      data: {
        tenantId: user.tid,
        studentId: dto.studentId,
        userId: dto.userId,
        fullName: dto.fullName.trim(),
        graduationYear: dto.graduationYear,
        programme: dto.programme,
        email: dto.email,
        phone: dto.phone,
        currentOrg: dto.currentOrg,
        currentRole: dto.currentRole,
        mentorshipOptIn: dto.mentorshipOptIn ?? false,
        status: 'ACTIVE',
        activatedAt: new Date(),
      },
    });
  }

  async update(
    tenantId: string,
    id: string,
    dto: Partial<{
      fullName: string;
      graduationYear: number;
      programme: string;
      department: string;
      email: string;
      phone: string;
      currentOrg: string;
      currentRole: string;
      mentorshipOptIn: boolean;
      status: string;
      directoryVisible: boolean;
    }>,
  ) {
    const row = await this.get(tenantId, id);
    if (!row) throw new NotFoundException('Alumni profile not found');
    return this.prisma.alumniProfile.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.fullName ? { fullName: dto.fullName.trim() } : {}),
        ...(dto.status === 'ACTIVE' && !row.activatedAt
          ? { activatedAt: new Date() }
          : {}),
      },
    });
  }

  async ensureDefaultMembershipTypes(tenantId: string) {
    await this.prisma.alumniMembershipType.updateMany({
      where: { tenantId, code: 'LIFE' },
      data: { isActive: false },
    });

    const count = await this.prisma.alumniMembershipType.count({
      where: { tenantId, code: { in: ['ANNUAL', 'PERMANENT'] } },
    });
    if (count >= 2) return;
    const now = new Date();
    const existing = await this.prisma.alumniMembershipType.findMany({
      where: { tenantId },
      select: { code: true },
    });
    const codes = new Set(existing.map((e) => e.code));
    const rows = [
      {
        id: randomUUID(),
        tenantId,
        code: 'ANNUAL',
        name: 'Annual Membership',
        description: 'Valid for one year',
        amountPaise: 20000,
        durationMonths: 12,
        isLifetime: false,
        sortOrder: 1,
        isActive: true,
        updatedAt: now,
      },
      {
        id: randomUUID(),
        tenantId,
        code: 'PERMANENT',
        name: 'Permanent Membership',
        description: 'One-time permanent membership',
        amountPaise: 100000,
        durationMonths: null as number | null,
        isLifetime: true,
        sortOrder: 2,
        isActive: true,
        updatedAt: now,
      },
    ].filter((r) => !codes.has(r.code));
    if (rows.length) {
      await this.prisma.alumniMembershipType.createMany({ data: rows });
    }
  }

  async ensureSettings(tenantId: string) {
    const existing = await this.prisma.alumniAssociationSettings.findUnique({
      where: { tenantId },
    });
    if (existing) return existing;
    return this.prisma.alumniAssociationSettings.create({
      data: {
        tenantId,
        associationName: 'Alumni Association',
        tagline: 'United by Education. Inspired by Don Bosco.',
        logoUrl: '/branding/college-logo.png',
        heroImageUrl: '/branding/alumni-campus-hero.png',
        heroImagesJson: ['/branding/alumni-campus-hero.png'],
        statsAlumni: 5000,
        statsLegacyYears: 80,
        statsEvents: 50,
        statsCountries: 20,
      },
    });
  }

  async getPortalInfo(tenantId: string) {
    await this.ensureDefaultMembershipTypes(tenantId);
    const settings = await this.ensureSettings(tenantId);
    const [activeMembers, pending, types, upcomingEvents] = await Promise.all([
      this.prisma.alumniProfile.count({
        where: { tenantId, status: 'ACTIVE' },
      }),
      this.prisma.alumniProfile.count({
        where: {
          tenantId,
          status: {
            in: [
              'PENDING_VERIFICATION',
              'OFFICE_VERIFIED',
              'COMMITTEE_APPROVED',
            ],
          },
        },
      }),
      this.prisma.alumniMembershipType.findMany({
        where: { tenantId, isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.alumniEvent.findMany({
        where: {
          tenantId,
          isPublished: true,
          startsAt: { gte: new Date() },
        },
        orderBy: { startsAt: 'asc' },
        take: 6,
      }),
    ]);

    const heroImages = this.normalizeHeroImages(
      settings.heroImagesJson,
      settings.heroImageUrl,
    );

    return {
      settings: {
        ...settings,
        heroImages,
      },
      stats: {
        activeMembers,
        pendingRegistrations: pending,
        displayAlumni: settings.statsAlumni || activeMembers,
        legacyYears: settings.statsLegacyYears,
        eventsOrganized: settings.statsEvents,
        countries: settings.statsCountries,
      },
      membershipTypes: types.map((t) => ({
        id: t.id,
        code: t.code,
        name: t.name,
        description: t.description,
        amountInr: t.amountPaise / 100,
        durationMonths: t.durationMonths,
        isLifetime: t.isLifetime,
      })),
      upcomingEvents,
    };
  }

  async updateSettings(
    user: JwtUser,
    dto: Partial<{
      associationName: string;
      tagline: string;
      contactEmail: string;
      contactPhone: string;
      address: string;
      logoUrl: string;
      heroImageUrl: string;
      heroImages: string[];
    }>,
  ) {
    await this.ensureSettings(user.tid);
    const heroImages = (dto.heroImages ?? [])
      .map((value) => value.trim())
      .filter(Boolean);

    return this.prisma.alumniAssociationSettings.update({
      where: { tenantId: user.tid },
      data: {
        ...(dto.associationName !== undefined
          ? {
              associationName:
                dto.associationName.trim() || 'Alumni Association',
            }
          : {}),
        ...(dto.tagline !== undefined
          ? { tagline: dto.tagline.trim() || null }
          : {}),
        ...(dto.contactEmail !== undefined
          ? { contactEmail: dto.contactEmail.trim() || null }
          : {}),
        ...(dto.contactPhone !== undefined
          ? { contactPhone: dto.contactPhone.trim() || null }
          : {}),
        ...(dto.address !== undefined
          ? { address: dto.address.trim() || null }
          : {}),
        ...(dto.logoUrl !== undefined
          ? { logoUrl: dto.logoUrl.trim() || null }
          : {}),
        ...(dto.heroImageUrl !== undefined
          ? { heroImageUrl: dto.heroImageUrl.trim() || null }
          : {}),
        ...(dto.heroImages !== undefined
          ? {
              heroImagesJson: heroImages,
              heroImageUrl: heroImages[0] ?? dto.heroImageUrl?.trim() ?? null,
            }
          : {}),
      },
    });
  }

  async registerPublic(tenantId: string, dto: AlumniRegisterDto) {
    const fullName = dto.fullName?.trim();
    if (!fullName) throw new BadRequestException('Full name is required');
    if (dto.certifyTrue === false) {
      throw new BadRequestException(
        'Please certify that the information provided is true',
      );
    }
    if (dto.photoUrl && dto.photoUrl.length > 1_500_000) {
      throw new BadRequestException(
        'Photo is too large. Please use a smaller image.',
      );
    }
    if (dto.email?.trim()) {
      const exists = await this.prisma.alumniProfile.findFirst({
        where: {
          tenantId,
          email: { equals: dto.email.trim(), mode: 'insensitive' },
        },
      });
      if (exists) {
        throw new ConflictException(
          'An alumni registration with this email already exists',
        );
      }
    }

    await this.ensureDefaultMembershipTypes(tenantId);

    let membershipTypeId = dto.membershipTypeId;
    if (!membershipTypeId) {
      const annual = await this.prisma.alumniMembershipType.findFirst({
        where: { tenantId, code: 'ANNUAL', isActive: true },
      });
      membershipTypeId = annual?.id;
    }

    const alumni = await this.prisma.alumniProfile.create({
      data: {
        tenantId,
        fullName,
        gender: dto.gender,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
        bloodGroup: dto.bloodGroup,
        photoUrl: dto.photoUrl?.trim() || null,
        graduationYear: dto.graduationYear,
        programme: dto.programme,
        department: dto.department,
        email: dto.email?.trim() || null,
        phone: dto.phone?.trim() || null,
        whatsapp: dto.whatsapp?.trim() || null,
        currentAddress: dto.currentAddress,
        state: dto.state,
        country: dto.country || 'India',
        pinCode: dto.pinCode,
        occupation: dto.occupation || dto.employmentStatus || null,
        currentOrg: dto.currentOrg,
        currentRole: dto.currentRole,
        officeAddress: dto.officeAddress,
        linkedinUrl: dto.linkedinUrl,
        facebookUrl: dto.facebookUrl,
        instagramUrl: dto.instagramUrl,
        emergencyName: dto.emergencyName,
        emergencyMobile: dto.emergencyMobile,
        emergencyRelation: dto.emergencyRelation,
        mentorshipOptIn: dto.mentorshipOptIn ?? false,
        status: 'PENDING_VERIFICATION',
        metadata: {
          collegeRollNumber: dto.collegeRollNumber?.trim() || null,
          universityRegNumber: dto.universityRegNumber?.trim() || null,
          websiteUrl: dto.websiteUrl?.trim() || null,
          employmentStatus: dto.employmentStatus?.trim() || null,
          agreeCommunications: dto.agreeCommunications ?? false,
          certifyTrue: dto.certifyTrue ?? false,
        },
      },
    });

    let membershipId: string | null = null;
    let amountPaise = 0;
    let membershipTypeName: string | null = null;
    if (membershipTypeId) {
      const membershipType = await this.prisma.alumniMembershipType.findFirst({
        where: { id: membershipTypeId, tenantId, isActive: true },
      });
      const membership = await this.prisma.alumniMembership.create({
        data: {
          tenantId,
          alumniId: alumni.id,
          membershipTypeId,
          status: 'PENDING_PAYMENT',
        },
      });
      membershipId = membership.id;
      amountPaise = membershipType?.amountPaise ?? 0;
      membershipTypeName = membershipType?.name ?? null;
    }

    let payment: {
      id: string;
      paymentToken: string;
      amountInr: number;
      currency: string;
      status: string;
    } | null = null;

    if (membershipId && amountPaise > 0) {
      const paymentToken = randomUUID();
      const created = await this.prisma.alumniPayment.create({
        data: {
          tenantId,
          alumniId: alumni.id,
          membershipId,
          amountPaise,
          currency: 'INR',
          status: 'PENDING',
          metadata: {
            paymentToken,
            membershipTypeId,
            membershipTypeName,
          },
        },
      });
      payment = {
        id: created.id,
        paymentToken,
        amountInr: amountPaise / 100,
        currency: 'INR',
        status: created.status,
      };
    }

    return {
      id: alumni.id,
      status: alumni.status,
      payment,
      message: payment
        ? 'Registration received. Please complete membership payment to continue.'
        : 'Registration received. The Alumni Office will verify your details before membership activation.',
    };
  }

  async convertStudent(user: JwtUser, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId: user.tid, deletedAt: null },
      include: {
        masterProfile: true,
        department: true,
        programVersion: { include: { program: true } },
        academicStanding: true,
      },
    });
    if (!student) throw new NotFoundException('Student not found');

    const existing = await this.prisma.alumniProfile.findFirst({
      where: { tenantId: user.tid, studentId },
    });
    if (existing) {
      return { alumni: existing, created: false };
    }

    const alumni = await this.prisma.alumniProfile.create({
      data: {
        tenantId: user.tid,
        studentId: student.id,
        userId: student.userId,
        fullName: student.masterProfile?.fullName ?? student.enrollmentNumber,
        email: student.masterProfile?.email,
        phone: student.masterProfile?.mobileNumber,
        gender: student.masterProfile?.gender,
        dateOfBirth: student.masterProfile?.dateOfBirth,
        programme: student.programVersion?.program?.name,
        department: student.department?.name,
        graduationYear: student.academicStanding?.completedAt
          ? student.academicStanding.completedAt.getFullYear()
          : new Date().getFullYear(),
        status: 'PENDING_VERIFICATION',
        metadata: {
          source: 'STUDENT_CONVERSION',
          enrollmentNumber: student.enrollmentNumber,
          rollNumber: student.rollNumber,
        },
      },
    });

    await this.prisma.studentProfile.updateMany({
      where: { studentId: student.id, tenantId: user.tid },
      data: { studentStatus: 'ALUMNI' },
    });
    await this.prisma.studentAcademicStanding.updateMany({
      where: { studentId: student.id, tenantId: user.tid },
      data: {
        programmeStatus: 'COMPLETED',
        alumniEligible: true,
        lifecycleState: 'ALUMNI',
      },
    });

    return { alumni, created: true };
  }

  async activateMembership(user: JwtUser, alumniId: string) {
    const alumni = await this.get(user.tid, alumniId);
    if (!alumni) throw new NotFoundException('Alumni profile not found');

    const year = new Date().getFullYear();
    const seq = String(
      (await this.prisma.alumniProfile.count({
        where: { tenantId: user.tid },
      })) + 1,
    ).padStart(4, '0');
    const membershipNumber = alumni.membershipNumber ?? `ALU-${year}-${seq}`;

    const membership = alumni.memberships[0];
    if (membership) {
      const type = membership.membershipType;
      const startsAt = new Date();
      const expiresAt =
        type.isLifetime || !type.durationMonths
          ? null
          : new Date(
              startsAt.getTime() +
                type.durationMonths * 30 * 24 * 60 * 60 * 1000,
            );
      await this.prisma.alumniMembership.update({
        where: { id: membership.id },
        data: { status: 'ACTIVE', startsAt, expiresAt },
      });
    }

    return this.prisma.alumniProfile.update({
      where: { id: alumniId },
      data: {
        status: 'ACTIVE',
        membershipNumber,
        activatedAt: new Date(),
      },
    });
  }

  async adminDashboard(tenantId: string) {
    const [
      total,
      active,
      pending,
      today,
      annual,
      life,
      donationSum,
      upcomingEvents,
    ] = await Promise.all([
      this.prisma.alumniProfile.count({ where: { tenantId } }),
      this.prisma.alumniProfile.count({
        where: { tenantId, status: 'ACTIVE' },
      }),
      this.prisma.alumniProfile.count({
        where: {
          tenantId,
          status: { in: ['PENDING_VERIFICATION', 'OFFICE_VERIFIED'] },
        },
      }),
      this.prisma.alumniProfile.count({
        where: {
          tenantId,
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      this.prisma.alumniMembership.count({
        where: {
          tenantId,
          status: 'ACTIVE',
          membershipType: { code: 'ANNUAL' },
        },
      }),
      this.prisma.alumniMembership.count({
        where: {
          tenantId,
          status: 'ACTIVE',
          membershipType: { isLifetime: true },
        },
      }),
      this.prisma.alumniDonation.aggregate({
        where: { tenantId, status: 'PAID' },
        _sum: { amountPaise: true },
      }),
      this.prisma.alumniEvent.count({
        where: {
          tenantId,
          isPublished: true,
          startsAt: { gte: new Date() },
        },
      }),
    ]);

    return {
      totalAlumni: total,
      activeMembers: active,
      pendingRegistrations: pending,
      todaysRegistrations: today,
      annualMembers: annual,
      lifeMembers: life,
      donationsInr: (donationSum._sum.amountPaise ?? 0) / 100,
      upcomingEvents,
    };
  }

  listDirectory(
    tenantId: string,
    query: {
      graduationYear?: number;
      department?: string;
      q?: string;
    } = {},
  ) {
    return this.prisma.alumniProfile.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        directoryVisible: true,
        ...(query.graduationYear
          ? { graduationYear: query.graduationYear }
          : {}),
        ...(query.department
          ? {
              department: {
                contains: query.department,
                mode: 'insensitive',
              },
            }
          : {}),
        ...(query.q?.trim()
          ? {
              OR: [
                { fullName: { contains: query.q.trim(), mode: 'insensitive' } },
                {
                  currentOrg: { contains: query.q.trim(), mode: 'insensitive' },
                },
                {
                  currentRole: {
                    contains: query.q.trim(),
                    mode: 'insensitive',
                  },
                },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        fullName: true,
        graduationYear: true,
        programme: true,
        department: true,
        currentOrg: true,
        currentRole: true,
        occupation: true,
        state: true,
        country: true,
        linkedinUrl: true,
      },
      orderBy: { fullName: 'asc' },
      take: 100,
    });
  }

  listAdminEvents(tenantId: string) {
    return this.prisma.alumniEvent.findMany({
      where: { tenantId },
      orderBy: { startsAt: 'desc' },
      take: 100,
    });
  }

  listPublishedEvents(tenantId: string) {
    return this.prisma.alumniEvent.findMany({
      where: { tenantId, isPublished: true },
      orderBy: { startsAt: 'asc' },
      take: 50,
    });
  }

  async createEvent(
    user: JwtUser,
    dto: {
      title: string;
      summary?: string;
      description?: string;
      eventType?: string;
      venue?: string;
      startsAt: string;
      endsAt?: string;
      isPublished?: boolean;
      coverUrl?: string;
    },
  ) {
    const title = dto.title?.trim();
    if (!title) throw new BadRequestException('Event title is required');
    if (!dto.startsAt) throw new BadRequestException('Start date is required');

    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60);
    const slug = `${baseSlug || 'event'}-${Date.now().toString(36)}`;

    return this.prisma.alumniEvent.create({
      data: {
        tenantId: user.tid,
        title,
        slug,
        summary: dto.summary?.trim() || null,
        description: dto.description?.trim() || null,
        eventType: dto.eventType?.trim() || 'REUNION',
        venue: dto.venue?.trim() || null,
        startsAt: new Date(dto.startsAt),
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        isPublished: dto.isPublished ?? true,
        coverUrl: dto.coverUrl?.trim() || null,
      },
    });
  }

  async setEventPublished(
    user: JwtUser,
    eventId: string,
    isPublished: boolean,
  ) {
    const row = await this.prisma.alumniEvent.findFirst({
      where: { id: eventId, tenantId: user.tid },
    });
    if (!row) throw new NotFoundException('Event not found');
    return this.prisma.alumniEvent.update({
      where: { id: eventId },
      data: { isPublished },
    });
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export type AcademicCategory = 'ARTS' | 'SCIENCE' | 'COMMERCE' | 'PROFESSIONAL';

const PUBLIC_STAFF_SELECT = {
  id: true,
  fullName: true,
  photoUrl: true,
  qualification: true,
  specialization: true,
  experienceYears: true,
  websiteSlug: true,
  publicEmail: true,
  email: true,
  publicPhone: true,
  officeLocation: true,
  googleScholarUrl: true,
  orcidUrl: true,
  researchAreas: true,
  showOnWebsite: true,
  staffType: true,
  status: true,
  designation: { select: { label: true, code: true } },
} satisfies Prisma.StaffProfileSelect;

type PublicStaffRow = Prisma.StaffProfileGetPayload<{
  select: typeof PUBLIC_STAFF_SELECT;
}>;

const WEBSITE_DEPARTMENT_TYPES = [
  'ACADEMIC',
  'ARTS',
  'SCIENCE',
  'COMMERCE',
  'PROFESSIONAL',
] as const;

@Injectable()
export class WebsiteAcademicService {
  constructor(private readonly prisma: PrismaService) {}

  private slugify(input: string) {
    return input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }

  private mapPublicStaff(staff: PublicStaffRow | null | undefined) {
    if (!staff || !staff.showOnWebsite || staff.status !== 'ACTIVE')
      return null;
    return {
      id: staff.id,
      name: staff.fullName,
      photoUrl: staff.photoUrl,
      designation: staff.designation?.label ?? null,
      qualification: staff.qualification,
      specialization: staff.specialization,
      experienceYears: staff.experienceYears,
      email: staff.publicEmail || staff.email || null,
      phone: staff.publicPhone || null,
      officeLocation: staff.officeLocation,
      googleScholarUrl: staff.googleScholarUrl,
      orcidUrl: staff.orcidUrl,
      researchAreas: staff.researchAreas,
      websiteSlug: staff.websiteSlug,
    };
  }

  private async statsForDepartment(tenantId: string, departmentId: string) {
    const [
      facultyTotal,
      facultyPublic,
      studentCount,
      programmeCount,
      publicationCount,
    ] = await Promise.all([
      this.prisma.staffProfile.count({
        where: {
          tenantId,
          departmentId,
          deletedAt: null,
          status: 'ACTIVE',
          staffType: 'TEACHING',
        },
      }),
      this.prisma.staffProfile.count({
        where: {
          tenantId,
          departmentId,
          deletedAt: null,
          status: 'ACTIVE',
          staffType: 'TEACHING',
          showOnWebsite: true,
        },
      }),
      this.prisma.student.count({
        where: { tenantId, departmentId, deletedAt: null },
      }),
      this.prisma.program.count({
        where: { tenantId, departmentId, deletedAt: null },
      }),
      this.prisma.staffPublication.count({
        where: {
          tenantId,
          staffProfile: {
            departmentId,
            deletedAt: null,
            status: 'ACTIVE',
          },
        },
      }),
    ]);

    return {
      facultyTotal,
      facultyPublic,
      facultyCount: facultyPublic,
      studentCount,
      programmeCount,
      publicationCount,
    };
  }

  private async featuredFaculty(
    tenantId: string,
    departmentId: string,
    featuredIds: unknown,
  ) {
    const preferred = Array.isArray(featuredIds)
      ? featuredIds.filter((id): id is string => typeof id === 'string')
      : [];

    const staff = await this.prisma.staffProfile.findMany({
      where: {
        tenantId,
        departmentId,
        deletedAt: null,
        status: 'ACTIVE',
        staffType: 'TEACHING',
        showOnWebsite: true,
      },
      select: PUBLIC_STAFF_SELECT,
      orderBy: [{ fullName: 'asc' }],
    });

    const ordered = preferred.length
      ? [
          ...preferred
            .map((id) => staff.find((row) => row.id === id))
            .filter(Boolean),
          ...staff.filter((row) => !preferred.includes(row.id)),
        ]
      : staff;

    const mapped = ordered
      .map((row) => this.mapPublicStaff(row!))
      .filter(Boolean) as NonNullable<
      ReturnType<WebsiteAcademicService['mapPublicStaff']>
    >[];

    return {
      featuredFaculty: mapped.slice(0, 3),
      moreFacultyCount: Math.max(0, mapped.length - 3),
      allFaculty: mapped,
    };
  }

  private primaryProgramme(
    programs: { name: string; level: string | null; code: string }[],
  ) {
    if (!programs.length) return null;
    const first = programs[0];
    return {
      name: first.name,
      level: first.level,
      code: first.code,
      label: first.level ? `${first.level} · ${first.name}` : first.name,
    };
  }

  async listDepartments(
    tenantId: string,
    query: { q?: string; category?: string } = {},
  ) {
    const category = query.category?.trim().toUpperCase();
    const q = query.q?.trim();

    const profiles = await this.prisma.websiteDepartmentProfile.findMany({
      where: {
        tenantId,
        showOnWebsite: true,
        ...(category && category !== 'ALL' ? { category } : {}),
        ...(q
          ? {
              OR: [
                { slug: { contains: q, mode: 'insensitive' } },
                { tagline: { contains: q, mode: 'insensitive' } },
                { aboutText: { contains: q, mode: 'insensitive' } },
                {
                  department: {
                    name: { contains: q, mode: 'insensitive' },
                    deletedAt: null,
                    status: 'ACTIVE',
                  },
                },
              ],
            }
          : {}),
        department: { deletedAt: null, status: 'ACTIVE' },
      },
      include: {
        department: {
          include: {
            hod: { select: PUBLIC_STAFF_SELECT },
            programs: {
              where: { deletedAt: null },
              orderBy: { name: 'asc' },
              select: { name: true, level: true, code: true },
            },
          },
        },
      },
      orderBy: [{ displayOrder: 'asc' }, { slug: 'asc' }],
    });

    const cards = await Promise.all(
      profiles.map(async (profile) => {
        const stats = await this.statsForDepartment(
          tenantId,
          profile.departmentId,
        );
        const { featuredFaculty, moreFacultyCount } =
          await this.featuredFaculty(
            tenantId,
            profile.departmentId,
            profile.featuredFacultyIds,
          );
        const hod = this.mapPublicStaff(profile.department.hod);
        return {
          id: profile.departmentId,
          name: profile.department.name,
          code: profile.department.code,
          slug: profile.slug,
          category: profile.category,
          tagline: profile.tagline,
          bannerUrl: profile.bannerUrl,
          establishedYear: profile.establishedYear,
          primaryProgramme: this.primaryProgramme(profile.department.programs),
          programmes: profile.department.programs,
          hod,
          stats: {
            ...stats,
            establishedYear: profile.establishedYear,
          },
          featuredFaculty,
          moreFacultyCount,
          href: `/departments/${profile.slug}`,
        };
      }),
    );

    return { items: cards, total: cards.length };
  }

  async getDepartment(tenantId: string, slug: string) {
    const profile = await this.prisma.websiteDepartmentProfile.findFirst({
      where: {
        tenantId,
        slug: slug.trim().toLowerCase(),
        showOnWebsite: true,
        department: { deletedAt: null, status: 'ACTIVE' },
      },
      include: {
        department: {
          include: {
            hod: { select: PUBLIC_STAFF_SELECT },
            programs: {
              where: { deletedAt: null },
              orderBy: { name: 'asc' },
              select: {
                id: true,
                name: true,
                level: true,
                code: true,
                versions: {
                  where: { deletedAt: null, status: 'PUBLISHED' },
                  select: { id: true, version: true, status: true },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    if (!profile) throw new NotFoundException('Department not found');

    const stats = await this.statsForDepartment(tenantId, profile.departmentId);
    const { featuredFaculty, moreFacultyCount, allFaculty } =
      await this.featuredFaculty(
        tenantId,
        profile.departmentId,
        profile.featuredFacultyIds,
      );

    const activities = await this.prisma.departmentActivity.findMany({
      where: {
        tenantId,
        departmentId: profile.departmentId,
        calendarPublishedAt: { not: null },
        status: { in: ['APPROVED', 'PUBLISHED', 'COMPLETED'] },
      },
      orderBy: { eventDate: 'desc' },
      take: 12,
      select: {
        id: true,
        title: true,
        activityType: true,
        eventDate: true,
        venue: true,
        description: true,
        posterUrl: true,
        bannerUrl: true,
      },
    });

    const publications = await this.prisma.staffPublication.findMany({
      where: {
        tenantId,
        staffProfile: {
          departmentId: profile.departmentId,
          deletedAt: null,
          status: 'ACTIVE',
          showOnWebsite: true,
        },
      },
      orderBy: { publishedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        title: true,
        publicationType: true,
        journal: true,
        doi: true,
        publishedAt: true,
        staffProfile: { select: { fullName: true, websiteSlug: true } },
      },
    });

    const awards = await this.prisma.staffAward.findMany({
      where: {
        tenantId,
        staffProfile: {
          departmentId: profile.departmentId,
          deletedAt: null,
          status: 'ACTIVE',
          showOnWebsite: true,
        },
      },
      orderBy: { awardDate: 'desc' },
      take: 12,
      select: {
        id: true,
        title: true,
        organization: true,
        level: true,
        awardDate: true,
        staffProfile: { select: { fullName: true, websiteSlug: true } },
      },
    });

    const programmesByLevel = profile.department.programs.reduce<
      Record<string, { name: string; level: string | null; code: string }[]>
    >((acc, program) => {
      const key = (program.level || 'OTHER').toUpperCase();
      acc[key] ??= [];
      acc[key].push({
        name: program.name,
        level: program.level,
        code: program.code,
      });
      return acc;
    }, {});

    const gallery = Array.isArray(profile.galleryJson)
      ? profile.galleryJson
      : [];
    const downloads = Array.isArray(profile.downloadsJson)
      ? profile.downloadsJson
      : [];

    return {
      id: profile.departmentId,
      name: profile.department.name,
      code: profile.department.code,
      slug: profile.slug,
      category: profile.category,
      tagline: profile.tagline,
      aboutText: profile.aboutText,
      aboutHtml: profile.aboutHtml,
      bannerUrl: profile.bannerUrl,
      hodMessage: profile.hodMessage,
      establishedYear: profile.establishedYear,
      contact: {
        email: profile.contactEmail,
        phone: profile.contactPhone,
        officeLocation: profile.officeLocation,
      },
      hod: this.mapPublicStaff(profile.department.hod),
      stats: {
        ...stats,
        establishedYear: profile.establishedYear,
      },
      primaryProgramme: this.primaryProgramme(profile.department.programs),
      programmes: profile.department.programs.map((p) => ({
        name: p.name,
        level: p.level,
        code: p.code,
      })),
      programmesByLevel,
      featuredFaculty,
      moreFacultyCount,
      faculty: allFaculty,
      activities,
      publications: publications.map((pub) => ({
        id: pub.id,
        title: pub.title,
        publicationType: pub.publicationType,
        journal: pub.journal,
        doi: pub.doi,
        publishedAt: pub.publishedAt,
        authorName: pub.staffProfile.fullName,
        authorSlug: pub.staffProfile.websiteSlug,
      })),
      awards: awards.map((award) => ({
        id: award.id,
        title: award.title,
        organization: award.organization,
        level: award.level,
        awardDate: award.awardDate,
        recipientName: award.staffProfile.fullName,
        recipientSlug: award.staffProfile.websiteSlug,
      })),
      gallery,
      downloads,
      timetable: { available: false, items: [] as unknown[] },
      href: `/departments/${profile.slug}`,
    };
  }

  async getFaculty(tenantId: string, slug: string) {
    const staff = await this.prisma.staffProfile.findFirst({
      where: {
        tenantId,
        websiteSlug: slug.trim().toLowerCase(),
        showOnWebsite: true,
        deletedAt: null,
        status: 'ACTIVE',
      },
      select: {
        ...PUBLIC_STAFF_SELECT,
        department: {
          select: {
            id: true,
            name: true,
            code: true,
            websiteProfile: {
              select: { slug: true, showOnWebsite: true },
            },
          },
        },
        qualifications: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            qualification: true,
            university: true,
            specialization: true,
          },
        },
        publications: {
          orderBy: { publishedAt: 'desc' },
          take: 30,
          select: {
            id: true,
            title: true,
            publicationType: true,
            journal: true,
            doi: true,
            publishedAt: true,
          },
        },
        awards: {
          orderBy: { awardDate: 'desc' },
          take: 20,
          select: {
            id: true,
            title: true,
            organization: true,
            level: true,
            awardDate: true,
          },
        },
      },
    });

    if (!staff) throw new NotFoundException('Faculty profile not found');

    const mapped = this.mapPublicStaff(staff);
    if (!mapped) throw new NotFoundException('Faculty profile not found');

    const deptSlug = staff.department?.websiteProfile?.showOnWebsite
      ? staff.department.websiteProfile.slug
      : null;

    return {
      ...mapped,
      department: staff.department
        ? {
            id: staff.department.id,
            name: staff.department.name,
            code: staff.department.code,
            slug: deptSlug,
            href: deptSlug ? `/departments/${deptSlug}` : null,
          }
        : null,
      qualifications: staff.qualifications,
      publications: staff.publications,
      awards: staff.awards,
      coursesTeaching: [] as unknown[],
      timetable: { available: false, items: [] as unknown[] },
      profileHref:
        deptSlug && staff.websiteSlug
          ? `/departments/${deptSlug}/faculty/${staff.websiteSlug}`
          : null,
    };
  }

  async search(tenantId: string, q?: string) {
    const term = q?.trim();
    if (!term) {
      return { departments: [], faculty: [], programmes: [] };
    }

    const [departments, faculty, programmes] = await Promise.all([
      this.listDepartments(tenantId, { q: term }).then((r) =>
        r.items.slice(0, 8),
      ),
      this.prisma.staffProfile.findMany({
        where: {
          tenantId,
          showOnWebsite: true,
          deletedAt: null,
          status: 'ACTIVE',
          OR: [
            { fullName: { contains: term, mode: 'insensitive' } },
            { specialization: { contains: term, mode: 'insensitive' } },
            { websiteSlug: { contains: term, mode: 'insensitive' } },
          ],
        },
        select: PUBLIC_STAFF_SELECT,
        take: 8,
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.program.findMany({
        where: {
          tenantId,
          deletedAt: null,
          department: {
            deletedAt: null,
            status: 'ACTIVE',
            websiteProfile: { showOnWebsite: true },
          },
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { code: { contains: term, mode: 'insensitive' } },
          ],
        },
        take: 8,
        select: {
          name: true,
          code: true,
          level: true,
          department: {
            select: {
              name: true,
              websiteProfile: { select: { slug: true } },
            },
          },
        },
      }),
    ]);

    return {
      departments,
      faculty: faculty.map((row) => this.mapPublicStaff(row)).filter(Boolean),
      programmes: programmes.map((program) => ({
        name: program.name,
        code: program.code,
        level: program.level,
        departmentName: program.department?.name ?? null,
        departmentSlug: program.department?.websiteProfile?.slug ?? null,
        href: program.department?.websiteProfile?.slug
          ? `/departments/${program.department.websiteProfile.slug}`
          : null,
      })),
    };
  }

  /** Admin helpers */
  async listProfilesForAdmin(tenantId: string) {
    const departments = await this.prisma.department.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: 'ACTIVE',
        departmentType: { in: [...WEBSITE_DEPARTMENT_TYPES] },
      },
      orderBy: { name: 'asc' },
      include: {
        websiteProfile: true,
        hod: { select: { id: true, fullName: true } },
        _count: {
          select: {
            staffMembers: true,
            programs: true,
            students: true,
          },
        },
      },
    });

    return departments.map((dept) => ({
      departmentId: dept.id,
      name: dept.name,
      code: dept.code,
      departmentType: dept.departmentType,
      hodName: dept.hod?.fullName ?? null,
      counts: dept._count,
      profile: dept.websiteProfile,
      suggestedSlug: this.slugify(dept.name),
      suggestedCategory: this.categoryFromDepartment(
        dept.departmentType,
        dept.name,
      ),
    }));
  }

  async upsertDepartmentProfile(
    tenantId: string,
    departmentId: string,
    data: {
      slug?: string;
      category?: string;
      tagline?: string;
      aboutText?: string;
      aboutHtml?: string;
      bannerUrl?: string | null;
      galleryJson?: unknown;
      contactEmail?: string | null;
      contactPhone?: string | null;
      officeLocation?: string | null;
      establishedYear?: number | null;
      showOnWebsite?: boolean;
      displayOrder?: number;
      featuredFacultyIds?: unknown;
      downloadsJson?: unknown;
      hodMessage?: string;
    },
  ) {
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, tenantId, deletedAt: null },
    });
    if (!department) throw new NotFoundException('Department not found');

    const existing = await this.prisma.websiteDepartmentProfile.findUnique({
      where: { departmentId },
    });

    const slug = this.slugify(
      data.slug?.trim() || existing?.slug || department.name || department.code,
    );

    return this.prisma.websiteDepartmentProfile.upsert({
      where: { departmentId },
      create: {
        tenantId,
        departmentId,
        slug,
        category: (data.category || 'ARTS').toUpperCase(),
        tagline: data.tagline ?? '',
        aboutText: data.aboutText ?? '',
        aboutHtml: data.aboutHtml ?? '',
        bannerUrl: data.bannerUrl ?? null,
        galleryJson: (data.galleryJson as Prisma.InputJsonValue) ?? [],
        contactEmail: data.contactEmail ?? null,
        contactPhone: data.contactPhone ?? null,
        officeLocation: data.officeLocation ?? null,
        establishedYear: data.establishedYear ?? null,
        showOnWebsite: data.showOnWebsite ?? false,
        displayOrder: data.displayOrder ?? 0,
        featuredFacultyIds:
          (data.featuredFacultyIds as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        downloadsJson: (data.downloadsJson as Prisma.InputJsonValue) ?? [],
        hodMessage: data.hodMessage ?? '',
      },
      update: {
        ...(data.slug !== undefined ? { slug } : {}),
        ...(data.category !== undefined
          ? { category: data.category.toUpperCase() }
          : {}),
        ...(data.tagline !== undefined ? { tagline: data.tagline } : {}),
        ...(data.aboutText !== undefined ? { aboutText: data.aboutText } : {}),
        ...(data.aboutHtml !== undefined ? { aboutHtml: data.aboutHtml } : {}),
        ...(data.bannerUrl !== undefined ? { bannerUrl: data.bannerUrl } : {}),
        ...(data.galleryJson !== undefined
          ? { galleryJson: data.galleryJson as Prisma.InputJsonValue }
          : {}),
        ...(data.contactEmail !== undefined
          ? { contactEmail: data.contactEmail }
          : {}),
        ...(data.contactPhone !== undefined
          ? { contactPhone: data.contactPhone }
          : {}),
        ...(data.officeLocation !== undefined
          ? { officeLocation: data.officeLocation }
          : {}),
        ...(data.establishedYear !== undefined
          ? { establishedYear: data.establishedYear }
          : {}),
        ...(data.showOnWebsite !== undefined
          ? { showOnWebsite: data.showOnWebsite }
          : {}),
        ...(data.displayOrder !== undefined
          ? { displayOrder: data.displayOrder }
          : {}),
        ...(data.featuredFacultyIds !== undefined
          ? {
              featuredFacultyIds:
                data.featuredFacultyIds as Prisma.InputJsonValue,
            }
          : {}),
        ...(data.downloadsJson !== undefined
          ? { downloadsJson: data.downloadsJson as Prisma.InputJsonValue }
          : {}),
        ...(data.hodMessage !== undefined
          ? { hodMessage: data.hodMessage }
          : {}),
      },
    });
  }

  async updateStaffWebsiteVisibility(
    tenantId: string,
    staffId: string,
    data: {
      showOnWebsite?: boolean;
      websiteSlug?: string | null;
      publicEmail?: string | null;
      publicPhone?: string | null;
      officeLocation?: string | null;
      googleScholarUrl?: string | null;
      orcidUrl?: string | null;
      researchAreas?: string | null;
    },
  ) {
    const staff = await this.prisma.staffProfile.findFirst({
      where: { id: staffId, tenantId, deletedAt: null },
    });
    if (!staff) throw new NotFoundException('Staff profile not found');

    const websiteSlug =
      data.websiteSlug === undefined
        ? undefined
        : data.websiteSlug
          ? this.slugify(data.websiteSlug)
          : null;

    return this.prisma.staffProfile.update({
      where: { id: staffId },
      data: {
        ...(data.showOnWebsite !== undefined
          ? { showOnWebsite: data.showOnWebsite }
          : {}),
        ...(websiteSlug !== undefined ? { websiteSlug } : {}),
        ...(data.publicEmail !== undefined
          ? { publicEmail: data.publicEmail }
          : {}),
        ...(data.publicPhone !== undefined
          ? { publicPhone: data.publicPhone }
          : {}),
        ...(data.officeLocation !== undefined
          ? { officeLocation: data.officeLocation }
          : {}),
        ...(data.googleScholarUrl !== undefined
          ? { googleScholarUrl: data.googleScholarUrl }
          : {}),
        ...(data.orcidUrl !== undefined ? { orcidUrl: data.orcidUrl } : {}),
        ...(data.researchAreas !== undefined
          ? { researchAreas: data.researchAreas }
          : {}),
      },
      select: {
        id: true,
        fullName: true,
        showOnWebsite: true,
        websiteSlug: true,
        publicEmail: true,
        publicPhone: true,
        officeLocation: true,
        googleScholarUrl: true,
        orcidUrl: true,
        researchAreas: true,
      },
    });
  }

  async publishAcademicDepartments(tenantId: string) {
    const departments = await this.prisma.department.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: 'ACTIVE',
        departmentType: { in: [...WEBSITE_DEPARTMENT_TYPES] },
      },
      include: {
        staffMembers: {
          where: {
            deletedAt: null,
            status: 'ACTIVE',
            staffType: 'TEACHING',
          },
          select: { id: true, fullName: true, websiteSlug: true },
        },
      },
    });

    let departmentsPublished = 0;
    let staffPublished = 0;

    for (const dept of departments) {
      const slug = this.slugify(dept.name || dept.code);
      const category = this.categoryFromDepartment(
        dept.departmentType,
        dept.name,
      );
      await this.prisma.websiteDepartmentProfile.upsert({
        where: { departmentId: dept.id },
        create: {
          tenantId,
          departmentId: dept.id,
          slug,
          showOnWebsite: true,
          category,
          tagline: `Department of ${dept.name}`,
        },
        update: { showOnWebsite: true, category },
      });
      departmentsPublished += 1;

      for (const member of dept.staffMembers) {
        const baseSlug =
          member.websiteSlug ||
          this.slugify(member.fullName) ||
          member.id.slice(0, 8);
        let websiteSlug = baseSlug;
        let attempt = 0;
        while (attempt < 5) {
          const clash = await this.prisma.staffProfile.findFirst({
            where: {
              tenantId,
              websiteSlug,
              NOT: { id: member.id },
              deletedAt: null,
            },
            select: { id: true },
          });
          if (!clash) break;
          attempt += 1;
          websiteSlug = `${baseSlug}-${member.id.slice(0, 4 + attempt)}`;
        }
        await this.prisma.staffProfile.update({
          where: { id: member.id },
          data: {
            showOnWebsite: true,
            websiteSlug,
          },
        });
        staffPublished += 1;
      }
    }

    return { departmentsPublished, staffPublished };
  }

  private categoryFromDepartment(
    departmentType: string | null | undefined,
    name: string,
  ): AcademicCategory {
    const type = (departmentType || '').toUpperCase();
    if (
      type === 'ARTS' ||
      type === 'SCIENCE' ||
      type === 'COMMERCE' ||
      type === 'PROFESSIONAL'
    ) {
      return type;
    }
    return this.guessCategory(name);
  }

  private guessCategory(name: string): AcademicCategory {
    const n = name.toLowerCase();
    if (/(commerce|account|business|management)/.test(n)) return 'COMMERCE';
    if (/(botany|chemistry|physics|zoology|math|science|computer)/.test(n))
      return 'SCIENCE';
    if (/(bba|bca|professional|tourism|mass|journalism)/.test(n))
      return 'PROFESSIONAL';
    return 'ARTS';
  }
}

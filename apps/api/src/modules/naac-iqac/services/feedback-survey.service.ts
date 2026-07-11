import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import {
  FEEDBACK_LIKERT_5,
  isCampaignOpen,
  ratingLabel,
  seedQuestionsForAudience,
} from '../constants/feedback.constants';
import type {
  CreateFeedbackCampaignDto,
  ReplaceFeedbackQuestionsDto,
  SubmitFeedbackResponseDto,
  UpdateFeedbackCampaignDto,
} from '../dto/feedback.dto';
import { naacDb } from './naac-prisma.util';

@Injectable()
export class FeedbackSurveyService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return naacDb(this.prisma);
  }

  private includeQuestions() {
    return {
      questions: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      },
      _count: { select: { responses: true, questions: true } },
    };
  }

  private mapCampaignForRespondent(
    c: any,
    submittedRow?: { id: string; submittedAt: Date } | null,
  ) {
    const open = isCampaignOpen(c);
    const submitted = Boolean(submittedRow);
    return {
      id: c.id,
      title: c.title,
      description: c.description,
      instructions: c.instructions,
      audience: c.audience,
      academicYear: c.academicYear,
      enabled: c.enabled,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
      status: c.status,
      isOpen: open,
      alreadySubmitted: submitted,
      submittedAt: submittedRow?.submittedAt ?? null,
      questionCount: c.questions?.length ?? 0,
      questions: open && !submitted ? c.questions : undefined,
      canSubmit: open && !submitted,
      closedReason: !c.enabled
        ? 'This feedback form is disabled by the college.'
        : c.status === 'DRAFT'
          ? 'This feedback form is not published yet.'
          : submitted
            ? 'You have already submitted this feedback.'
            : !open
              ? 'Feedback window is closed. Submissions are accepted only between the configured dates.'
              : null,
    };
  }

  async listCampaigns(tenantId: string, audience?: string) {
    return this.db().feedbackCampaign.findMany({
      where: {
        tenantId,
        ...(audience ? { audience } : {}),
      },
      include: this.includeQuestions(),
      orderBy: [{ updatedAt: 'desc' }],
    });
  }

  async getCampaign(tenantId: string, id: string) {
    const row = await this.db().feedbackCampaign.findFirst({
      where: { id, tenantId },
      include: this.includeQuestions(),
    });
    if (!row) throw new NotFoundException('Feedback campaign not found');
    return row;
  }

  async createCampaign(user: JwtUser, dto: CreateFeedbackCampaignDto) {
    return this.db().feedbackCampaign.create({
      data: {
        tenantId: user.tid,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        instructions:
          dto.instructions?.trim() ||
          'Kindly select the appropriate option as per the following criteria.',
        audience: dto.audience ?? 'STUDENT',
        academicYear: dto.academicYear.trim(),
        enabled: dto.enabled ?? false,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        status: dto.enabled ? 'PUBLISHED' : 'DRAFT',
        createdById: user.sub,
      },
      include: this.includeQuestions(),
    });
  }

  async updateCampaign(
    user: JwtUser,
    id: string,
    dto: UpdateFeedbackCampaignDto,
  ) {
    await this.getCampaign(user.tid, id);
    const data: Record<string, unknown> = {};
    if (dto.title != null) data.title = dto.title.trim();
    if (dto.description !== undefined)
      data.description = dto.description?.trim() || null;
    if (dto.instructions !== undefined)
      data.instructions = dto.instructions?.trim() || null;
    if (dto.academicYear != null) data.academicYear = dto.academicYear.trim();
    if (dto.audience != null) data.audience = dto.audience;
    if (dto.enabled !== undefined) {
      data.enabled = dto.enabled;
      if (dto.enabled && dto.status == null) data.status = 'PUBLISHED';
      if (!dto.enabled && dto.status == null) data.status = 'CLOSED';
    }
    if (dto.startsAt !== undefined)
      data.startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
    if (dto.endsAt !== undefined)
      data.endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    if (dto.status != null) data.status = dto.status;

    return this.db().feedbackCampaign.update({
      where: { id },
      data,
      include: this.includeQuestions(),
    });
  }

  async replaceQuestions(
    user: JwtUser,
    campaignId: string,
    dto: ReplaceFeedbackQuestionsDto,
  ) {
    await this.getCampaign(user.tid, campaignId);
    await this.db().feedbackQuestion.deleteMany({
      where: { tenantId: user.tid, campaignId },
    });
    await this.db().feedbackQuestion.createMany({
      data: dto.questions.map((q, index) => ({
        tenantId: user.tid,
        campaignId,
        prompt: q.prompt.trim(),
        category: q.category ?? 'OVERALL',
        required: q.required ?? true,
        sortOrder: q.sortOrder ?? index * 10,
        isActive: q.isActive ?? true,
        questionType: q.questionType ?? 'LIKERT_5',
      })),
    });
    return this.getCampaign(user.tid, campaignId);
  }

  async seedDefaultQuestions(
    user: JwtUser,
    campaignId: string,
    audienceHint?: string,
  ) {
    const campaign = await this.getCampaign(user.tid, campaignId);
    const audience = audienceHint ?? campaign.audience ?? 'STUDENT';
    const defaults = seedQuestionsForAudience(audience);
    return this.replaceQuestions(user, campaignId, {
      questions: defaults.map((d, i) => ({
        prompt: d.prompt,
        category: d.category,
        required: d.required ?? true,
        sortOrder: (i + 1) * 10,
        questionType: 'LIKERT_5',
      })),
    });
  }

  /** @deprecated use seedDefaultQuestions */
  async seedDefaultStudentQuestions(user: JwtUser, campaignId: string) {
    return this.seedDefaultQuestions(user, campaignId, 'STUDENT');
  }

  async deleteCampaign(user: JwtUser, id: string) {
    await this.getCampaign(user.tid, id);
    await this.db().feedbackCampaign.delete({ where: { id } });
    return { ok: true };
  }

  private async resolveStudent(user: JwtUser) {
    const student = await this.db().student.findFirst({
      where: { tenantId: user.tid, userId: user.sub, deletedAt: null },
      select: {
        id: true,
        departmentId: true,
        rollNumber: true,
        enrollmentNumber: true,
        academicStanding: { select: { currentSemesterSequence: true } },
        department: { select: { name: true } },
        programVersion: {
          select: { program: { select: { name: true } } },
        },
        masterProfile: { select: { fullName: true } },
        user: { select: { displayName: true } },
      },
    });
    if (!student) throw new ForbiddenException('Student profile not found');
    return student;
  }

  private async resolveStaffProfile(user: JwtUser) {
    const staff = await this.db().staffProfile.findFirst({
      where: { tenantId: user.tid, portalUserId: user.sub, deletedAt: null },
      select: {
        id: true,
        departmentId: true,
        employeeCode: true,
        fullName: true,
        department: { select: { name: true } },
        portalUser: { select: { displayName: true, email: true } },
      },
    });
    return staff;
  }

  /** Audiences this user may respond to */
  async resolveMyAudiences(user: JwtUser): Promise<string[]> {
    const audiences: string[] = [];
    const student = await this.db().student.findFirst({
      where: { tenantId: user.tid, userId: user.sub, deletedAt: null },
      select: { id: true },
    });
    if (student) audiences.push('STUDENT');

    const staff = await this.resolveStaffProfile(user);
    if (staff) audiences.push('TEACHER');

    const roles = (user.roles ?? []).map((r) => r.toLowerCase());
    if (roles.some((r) => r.includes('alumni'))) audiences.push('ALUMNI');
    // Staff may also fill alumni surveys when invited (e.g. alumni who teach)
    if (staff && !audiences.includes('ALUMNI')) {
      // Alumni campaigns listed separately via query; do not auto-add
    }

    return audiences;
  }

  async listOpenForStudent(user: JwtUser) {
    return this.listOpenForAudiences(user, ['STUDENT']);
  }

  async listOpenForMe(user: JwtUser, audience?: string) {
    if (audience) {
      const allowed = await this.resolveMyAudiences(user);
      if (audience === 'ALUMNI') {
        // Any authenticated user can be invited to alumni forms (trackable by user id)
        return this.listOpenForAudiences(user, ['ALUMNI']);
      }
      if (!allowed.includes(audience) && audience !== 'TEACHER') {
        throw new ForbiddenException(
          `You cannot access ${audience} feedback forms.`,
        );
      }
      if (audience === 'TEACHER') {
        const staff = await this.resolveStaffProfile(user);
        if (!staff) throw new ForbiddenException('Staff profile not found');
      }
      if (audience === 'STUDENT') await this.resolveStudent(user);
      return this.listOpenForAudiences(user, [audience]);
    }
    const audiences = await this.resolveMyAudiences(user);
    if (!audiences.length) {
      // Fall back: allow TEACHER list empty if no staff; student path may still 403
      const staff = await this.resolveStaffProfile(user);
      if (staff) return this.listOpenForAudiences(user, ['TEACHER']);
      return this.listOpenForAudiences(user, ['STUDENT']);
    }
    return this.listOpenForAudiences(user, audiences);
  }

  private async listOpenForAudiences(user: JwtUser, audiences: string[]) {
    const student = audiences.includes('STUDENT')
      ? await this.db().student.findFirst({
          where: { tenantId: user.tid, userId: user.sub, deletedAt: null },
          select: { id: true },
        })
      : null;

    const campaigns = await this.db().feedbackCampaign.findMany({
      where: {
        tenantId: user.tid,
        audience: { in: audiences },
        status: { in: ['PUBLISHED', 'CLOSED'] },
      },
      include: {
        questions: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            prompt: true,
            category: true,
            required: true,
            sortOrder: true,
            questionType: true,
          },
        },
        responses: {
          where: {
            OR: [
              ...(student ? [{ studentId: student.id }] : []),
              { respondentUserId: user.sub },
            ],
          },
          select: { id: true, submittedAt: true },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return {
      scale: FEEDBACK_LIKERT_5,
      audiences,
      items: campaigns.map((c: any) =>
        this.mapCampaignForRespondent(c, c.responses?.[0] ?? null),
      ),
    };
  }

  async submitAsStudent(
    user: JwtUser,
    campaignId: string,
    dto: SubmitFeedbackResponseDto,
  ) {
    return this.submitResponse(user, campaignId, dto, 'STUDENT');
  }

  async submitAsMe(
    user: JwtUser,
    campaignId: string,
    dto: SubmitFeedbackResponseDto,
  ) {
    const campaign = await this.getCampaign(user.tid, campaignId);
    return this.submitResponse(user, campaignId, dto, campaign.audience);
  }

  private async submitResponse(
    user: JwtUser,
    campaignId: string,
    dto: SubmitFeedbackResponseDto,
    expectedAudience: string,
  ) {
    const campaign = await this.getCampaign(user.tid, campaignId);
    if (campaign.audience !== expectedAudience) {
      throw new BadRequestException(
        `This feedback form is for ${campaign.audience.toLowerCase()} respondents.`,
      );
    }
    if (!isCampaignOpen(campaign)) {
      throw new BadRequestException(
        'Feedback is closed. You can submit only when the form is enabled and within the allowed date window.',
      );
    }

    let studentId: string | null = null;
    let departmentId: string | null = null;
    let programmeHint: string | null = null;
    let semesterNo: number | null = null;

    if (campaign.audience === 'STUDENT') {
      const student = await this.resolveStudent(user);
      studentId = student.id;
      departmentId = student.departmentId;
      programmeHint = student.programVersion?.program?.name ?? null;
      semesterNo = student.academicStanding?.currentSemesterSequence ?? null;
    } else if (campaign.audience === 'TEACHER') {
      const staff = await this.resolveStaffProfile(user);
      if (!staff) throw new ForbiddenException('Staff profile not found');
      departmentId = staff.departmentId;
      programmeHint = staff.department?.name ?? null;
    } else if (campaign.audience === 'ALUMNI') {
      // Authenticated user; optional staff/student profile for department hint
      const staff = await this.resolveStaffProfile(user);
      if (staff) {
        departmentId = staff.departmentId;
        programmeHint = staff.department?.name ?? 'Alumni';
      } else {
        programmeHint = 'Alumni';
      }
    } else {
      throw new BadRequestException(
        `Audience ${campaign.audience} is not supported for online submission yet.`,
      );
    }

    const existing = await this.db().feedbackResponse.findFirst({
      where: {
        tenantId: user.tid,
        campaignId,
        OR: [
          ...(studentId ? [{ studentId }] : []),
          { respondentUserId: user.sub },
        ],
      },
    });
    if (existing) {
      throw new ConflictException('You have already submitted this feedback.');
    }

    const activeQuestions = (campaign.questions ?? []).filter(
      (q: any) => q.isActive !== false,
    );
    const byId = new Map(activeQuestions.map((q: any) => [q.id, q]));
    for (const q of activeQuestions) {
      if (!q.required) continue;
      if (!dto.answers.some((a) => a.questionId === q.id)) {
        throw new BadRequestException(`Please answer: ${q.prompt}`);
      }
    }
    for (const a of dto.answers) {
      if (!byId.has(a.questionId)) {
        throw new BadRequestException('Invalid question in submission.');
      }
      if (a.rating < 1 || a.rating > 5) {
        throw new BadRequestException('Rating must be between 1 and 5.');
      }
    }

    const response = await this.db().feedbackResponse.create({
      data: {
        tenantId: user.tid,
        campaignId,
        studentId,
        respondentUserId: user.sub,
        departmentId,
        programmeHint,
        semesterNo,
        answers: {
          create: dto.answers.map((a) => ({
            tenantId: user.tid,
            questionId: a.questionId,
            rating: a.rating,
            ratingLabel: ratingLabel(a.rating),
          })),
        },
      },
      include: { answers: true },
    });

    return {
      id: response.id,
      submittedAt: response.submittedAt,
      message: 'Thank you. Your feedback has been submitted.',
    };
  }

  /** Admin: identity visible for tracking */
  async listResponses(tenantId: string, campaignId: string) {
    const campaign = await this.getCampaign(tenantId, campaignId);
    const rows = await this.db().feedbackResponse.findMany({
      where: { tenantId, campaignId },
      include: {
        answers: {
          include: { question: { select: { prompt: true, category: true } } },
        },
      },
      orderBy: { submittedAt: 'desc' },
      take: 2000,
    });

    const studentIds = [
      ...new Set(
        rows
          .map((r: any) => r.studentId as string | null)
          .filter(Boolean) as string[],
      ),
    ];
    const userIds = [
      ...new Set(
        rows
          .map((r: any) => r.respondentUserId as string | null)
          .filter(Boolean) as string[],
      ),
    ];

    const [students, users] = await Promise.all([
      studentIds.length
        ? this.db().student.findMany({
            where: { tenantId, id: { in: studentIds } },
            select: {
              id: true,
              rollNumber: true,
              enrollmentNumber: true,
              masterProfile: { select: { fullName: true } },
              user: { select: { displayName: true } },
              department: { select: { name: true } },
            },
          })
        : Promise.resolve([]),
      userIds.length
        ? this.db().user.findMany({
            where: { tenantId, id: { in: userIds } },
            select: {
              id: true,
              displayName: true,
              email: true,
              staffProfile: {
                select: {
                  fullName: true,
                  employeeCode: true,
                  department: { select: { name: true } },
                },
              },
            },
          })
        : Promise.resolve([]),
    ]);

    const studentMap = new Map<string, (typeof students)[number]>(
      students.map((s: (typeof students)[number]) => [s.id, s]),
    );
    const userMap = new Map<string, (typeof users)[number]>(
      users.map((u: (typeof users)[number]) => [u.id, u]),
    );

    return rows.map((r: any) => {
      const s = r.studentId ? studentMap.get(r.studentId as string) : null;
      const u = r.respondentUserId
        ? userMap.get(r.respondentUserId as string)
        : null;
      const name =
        s?.masterProfile?.fullName?.trim() ||
        s?.user?.displayName?.trim() ||
        u?.staffProfile?.fullName?.trim() ||
        u?.displayName?.trim() ||
        u?.email ||
        '—';
      return {
        id: r.id,
        submittedAt: r.submittedAt,
        semesterNo: r.semesterNo,
        programmeHint: r.programmeHint,
        audience: campaign.audience,
        respondent: {
          studentId: r.studentId,
          userId: r.respondentUserId,
          name,
          code:
            s?.rollNumber ??
            s?.enrollmentNumber ??
            u?.staffProfile?.employeeCode ??
            null,
          department:
            s?.department?.name ?? u?.staffProfile?.department?.name ?? null,
          email: u?.email ?? null,
        },
        /** @deprecated use respondent — kept for student UI compatibility */
        student: {
          id: r.studentId,
          name,
          rollNumber:
            s?.rollNumber ??
            s?.enrollmentNumber ??
            u?.staffProfile?.employeeCode ??
            null,
          department:
            s?.department?.name ?? u?.staffProfile?.department?.name ?? null,
        },
        answers: r.answers.map((a: any) => ({
          questionId: a.questionId,
          prompt: a.question?.prompt,
          category: a.question?.category,
          rating: a.rating,
          ratingLabel: a.ratingLabel,
        })),
      };
    });
  }

  /** Anonymous aggregates for reports (no respondent identity) */
  async analytics(tenantId: string, campaignId: string) {
    const campaign = await this.getCampaign(tenantId, campaignId);
    const answers = await this.db().feedbackAnswer.findMany({
      where: { tenantId, response: { campaignId } },
      select: {
        questionId: true,
        rating: true,
        question: { select: { prompt: true, category: true, sortOrder: true } },
      },
    });
    const responseCount = await this.db().feedbackResponse.count({
      where: { tenantId, campaignId },
    });

    const byQuestion = new Map<
      string,
      {
        questionId: string;
        prompt: string;
        category: string;
        sortOrder: number;
        counts: Record<number, number>;
        sum: number;
        n: number;
      }
    >();

    for (const a of answers) {
      let row = byQuestion.get(a.questionId);
      if (!row) {
        row = {
          questionId: a.questionId,
          prompt: a.question?.prompt ?? '',
          category: a.question?.category ?? 'OVERALL',
          sortOrder: a.question?.sortOrder ?? 0,
          counts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          sum: 0,
          n: 0,
        };
        byQuestion.set(a.questionId, row);
      }
      row.counts[a.rating] = (row.counts[a.rating] ?? 0) + 1;
      row.sum += a.rating;
      row.n += 1;
    }

    const questions = [...byQuestion.values()]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((q) => ({
        questionId: q.questionId,
        prompt: q.prompt,
        category: q.category,
        responseCount: q.n,
        average: q.n ? Math.round((q.sum / q.n) * 100) / 100 : 0,
        distribution: FEEDBACK_LIKERT_5.map((s) => ({
          rating: s.rating,
          label: s.label,
          count: q.counts[s.rating] ?? 0,
        })),
      }));

    return {
      campaign: {
        id: campaign.id,
        title: campaign.title,
        academicYear: campaign.academicYear,
        audience: campaign.audience,
      },
      responseCount,
      scale: FEEDBACK_LIKERT_5,
      questions,
      note: 'Analytics are anonymous. Individual respondents are available only in the admin Responses list.',
    };
  }

  scale() {
    return FEEDBACK_LIKERT_5;
  }
}

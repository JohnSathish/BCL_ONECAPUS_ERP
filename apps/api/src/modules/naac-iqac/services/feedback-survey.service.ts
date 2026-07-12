import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import ExcelJS from 'exceljs';
import puppeteer from 'puppeteer';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import {
  FEEDBACK_LIKERT_5,
  answerComparableValue,
  defaultOptionsForType,
  evaluateShowIf,
  isCampaignOpen,
  isNumericType,
  isObjectiveType,
  isTextType,
  ratingLabel,
  seedQuestionsForAudience,
  type FeedbackConditionalLogic,
  type FeedbackOption,
  type FeedbackShowIf,
  type FeedbackValidation,
} from '../constants/feedback.constants';
import type {
  CreateFeedbackCampaignDto,
  FeedbackAnswerInputDto,
  ReplaceFeedbackQuestionsDto,
  SubmitFeedbackResponseDto,
  UpdateFeedbackCampaignDto,
} from '../dto/feedback.dto';
import { naacDb } from './naac-prisma.util';

type AnswerCreatePayload = {
  tenantId: string;
  questionId: string;
  rating?: number | null;
  ratingLabel?: string | null;
  valueText?: string | null;
  valueNumber?: number | null;
  valueBool?: boolean | null;
  valueDate?: Date | null;
  valueJson?: unknown;
};

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

    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const idMap = new Map<string, string>();
    const prepared = dto.questions.map((q, index) => {
      const questionType = q.questionType ?? 'LIKERT_5';
      const provided = Array.isArray(q.options) ? q.options : [];
      const options =
        provided.length > 0
          ? provided.map((o) => ({
              value: String(o.value),
              label: String(o.label),
            }))
          : defaultOptionsForType(questionType);
      const draftKey = q.id?.trim() || `idx-${index}`;
      const newId = q.id && uuidRe.test(q.id) ? q.id : randomUUID();
      idMap.set(draftKey, newId);
      return { q, index, questionType, options, newId, draftKey };
    });

    // Remap showIf targets that still point at draft keys / prior ids
    for (const row of prepared) {
      idMap.set(String(row.index), row.newId);
    }

    await this.db().feedbackQuestion.createMany({
      data: prepared.map(({ q, index, questionType, options, newId }) => {
        const logic = {
          ...((q.conditionalLogic ?? {}) as Record<string, any>),
        };
        if (logic.showIf?.questionId) {
          const mapped = idMap.get(String(logic.showIf.questionId));
          if (mapped) logic.showIf = { ...logic.showIf, questionId: mapped };
        }
        return {
          id: newId,
          tenantId: user.tid,
          campaignId,
          prompt: q.prompt.trim(),
          description: q.description?.trim() || null,
          helpText: q.helpText?.trim() || null,
          placeholder: q.placeholder?.trim() || null,
          defaultValue:
            q.defaultValue === undefined ? undefined : (q.defaultValue as any),
          category: q.category ?? 'OVERALL',
          required: q.required ?? true,
          sortOrder: q.sortOrder ?? index * 10,
          isActive: q.isActive ?? true,
          questionType,
          options,
          validation: (q.validation ?? {}) as any,
          conditionalLogic: logic as any,
        };
      }),
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
            description: true,
            helpText: true,
            placeholder: true,
            defaultValue: true,
            category: true,
            required: true,
            sortOrder: true,
            questionType: true,
            options: true,
            validation: true,
            conditionalLogic: true,
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

  private questionOptions(question: any): FeedbackOption[] {
    const raw = question?.options;
    if (Array.isArray(raw) && raw.length) {
      return raw
        .map((o: any) => ({
          value: String(o?.value ?? ''),
          label: String(o?.label ?? o?.value ?? ''),
        }))
        .filter((o: FeedbackOption) => o.value);
    }
    return defaultOptionsForType(question?.questionType ?? 'LIKERT_5');
  }

  private questionValidation(question: any): FeedbackValidation {
    const v = question?.validation;
    return v && typeof v === 'object' && !Array.isArray(v)
      ? (v as FeedbackValidation)
      : {};
  }

  private questionShowIf(question: any): FeedbackShowIf | undefined {
    const logic = question?.conditionalLogic as FeedbackConditionalLogic | null;
    return logic?.showIf;
  }

  private buildAnswersByQuestionId(
    answers: FeedbackAnswerInputDto[],
  ): Map<string, ReturnType<typeof answerComparableValue>> {
    const map = new Map<string, ReturnType<typeof answerComparableValue>>();
    for (const a of answers) {
      map.set(a.questionId, answerComparableValue(a));
    }
    return map;
  }

  private buildAnswerPayload(
    tenantId: string,
    question: any,
    answer: FeedbackAnswerInputDto,
  ): AnswerCreatePayload {
    const type = question.questionType ?? 'LIKERT_5';
    const options = this.questionOptions(question);
    const validation = this.questionValidation(question);
    const base: AnswerCreatePayload = {
      tenantId,
      questionId: answer.questionId,
    };

    const findOption = (value: string) =>
      options.find((o) => o.value === value || o.label === value);

    if (type === 'LIKERT_5' || type === 'rating') {
      const rating =
        answer.rating ??
        (answer.valueNumber != null
          ? Math.round(Number(answer.valueNumber))
          : null) ??
        (answer.valueText != null && answer.valueText !== ''
          ? Number(answer.valueText)
          : null);
      if (rating == null || Number.isNaN(rating)) {
        throw new BadRequestException(`Please rate: ${question.prompt}`);
      }
      const max = type === 'LIKERT_5' ? 5 : (validation.max ?? 5);
      const min = validation.min ?? 1;
      if (rating < min || rating > max) {
        throw new BadRequestException(
          `Rating for "${question.prompt}" must be between ${min} and ${max}.`,
        );
      }
      const opt = findOption(String(rating));
      return {
        ...base,
        rating,
        ratingLabel:
          opt?.label ??
          (type === 'LIKERT_5' ? ratingLabel(rating) : String(rating)),
        valueNumber: rating,
      };
    }

    if (type === 'yes_no' || type === 'true_false') {
      let boolVal: boolean | null =
        answer.valueBool != null ? Boolean(answer.valueBool) : null;
      let textVal =
        answer.valueText != null ? String(answer.valueText).trim() : '';
      if (boolVal == null && textVal) {
        const lower = textVal.toLowerCase();
        if (['yes', 'true', '1'].includes(lower)) boolVal = true;
        else if (['no', 'false', '0'].includes(lower)) boolVal = false;
      }
      if (boolVal == null && answer.rating != null) {
        boolVal = answer.rating >= 3;
      }
      if (boolVal == null) {
        throw new BadRequestException(`Please answer: ${question.prompt}`);
      }
      const value =
        type === 'yes_no'
          ? boolVal
            ? 'yes'
            : 'no'
          : boolVal
            ? 'true'
            : 'false';
      const opt = findOption(value);
      return {
        ...base,
        valueBool: boolVal,
        valueText: value,
        ratingLabel:
          opt?.label ??
          (boolVal
            ? type === 'yes_no'
              ? 'Yes'
              : 'True'
            : type === 'yes_no'
              ? 'No'
              : 'False'),
      };
    }

    if (type === 'single_choice' || type === 'dropdown') {
      const value =
        (answer.valueText != null && String(answer.valueText).trim()) ||
        (answer.valueJson != null &&
        typeof answer.valueJson === 'object' &&
        !Array.isArray(answer.valueJson)
          ? String((answer.valueJson as { value?: unknown }).value ?? '')
          : '') ||
        (answer.rating != null ? String(answer.rating) : '');
      if (!value) {
        throw new BadRequestException(`Please answer: ${question.prompt}`);
      }
      const opt = findOption(value);
      if (options.length && !opt) {
        throw new BadRequestException(`Invalid option for: ${question.prompt}`);
      }
      return {
        ...base,
        valueText: opt?.value ?? value,
        ratingLabel: opt?.label ?? value,
      };
    }

    if (type === 'multi_choice') {
      let values: string[] = [];
      if (Array.isArray(answer.valueJson)) {
        values = answer.valueJson.map(String);
      } else if (answer.valueText) {
        try {
          const parsed = JSON.parse(answer.valueText);
          if (Array.isArray(parsed)) values = parsed.map(String);
          else values = [String(answer.valueText)];
        } catch {
          values = answer.valueText
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        }
      }
      if (!values.length) {
        throw new BadRequestException(`Please answer: ${question.prompt}`);
      }
      if (options.length) {
        const allowed = new Set(options.map((o) => o.value));
        for (const v of values) {
          if (!allowed.has(v) && !options.some((o) => o.label === v)) {
            throw new BadRequestException(
              `Invalid option for: ${question.prompt}`,
            );
          }
        }
        values = values.map((v) => findOption(v)?.value ?? v);
      }
      const labels = values.map((v) => findOption(v)?.label ?? v);
      return {
        ...base,
        valueJson: values,
        ratingLabel: labels.join(', '),
        valueText: values.join(', '),
      };
    }

    if (type === 'short_text' || type === 'long_text' || type === 'time') {
      const text =
        answer.valueText != null
          ? String(answer.valueText)
          : answer.rating != null
            ? String(answer.rating)
            : '';
      const trimmed = text.trim();
      if (!trimmed && question.required) {
        throw new BadRequestException(`Please answer: ${question.prompt}`);
      }
      if (
        validation.minLength != null &&
        trimmed.length < validation.minLength
      ) {
        throw new BadRequestException(
          `"${question.prompt}" must be at least ${validation.minLength} characters.`,
        );
      }
      if (
        validation.maxLength != null &&
        trimmed.length > validation.maxLength
      ) {
        throw new BadRequestException(
          `"${question.prompt}" must be at most ${validation.maxLength} characters.`,
        );
      }
      return { ...base, valueText: trimmed || null };
    }

    if (type === 'integer' || type === 'decimal') {
      const num =
        answer.valueNumber != null
          ? Number(answer.valueNumber)
          : answer.valueText != null && answer.valueText !== ''
            ? Number(answer.valueText)
            : answer.rating != null
              ? Number(answer.rating)
              : NaN;
      if (Number.isNaN(num)) {
        throw new BadRequestException(
          `Please enter a number for: ${question.prompt}`,
        );
      }
      if (type === 'integer' && !Number.isInteger(num)) {
        throw new BadRequestException(
          `"${question.prompt}" must be a whole number.`,
        );
      }
      if (validation.min != null && num < validation.min) {
        throw new BadRequestException(
          `"${question.prompt}" must be at least ${validation.min}.`,
        );
      }
      if (validation.max != null && num > validation.max) {
        throw new BadRequestException(
          `"${question.prompt}" must be at most ${validation.max}.`,
        );
      }
      return {
        ...base,
        valueNumber: num,
        valueText: String(num),
        ratingLabel: String(num),
      };
    }

    if (type === 'date' || type === 'datetime') {
      const raw = answer.valueDate ?? answer.valueText ?? null;
      if (!raw) {
        throw new BadRequestException(`Please answer: ${question.prompt}`);
      }
      const date = new Date(raw);
      if (Number.isNaN(date.getTime())) {
        throw new BadRequestException(`Invalid date for: ${question.prompt}`);
      }
      return {
        ...base,
        valueDate: date,
        valueText: typeof raw === 'string' ? raw : date.toISOString(),
        ratingLabel: date.toISOString(),
      };
    }

    if (type === 'file_upload') {
      const meta =
        answer.valueJson &&
        typeof answer.valueJson === 'object' &&
        !Array.isArray(answer.valueJson)
          ? (answer.valueJson as Record<string, unknown>)
          : null;
      const url = meta?.url != null ? String(meta.url) : '';
      const name = meta?.name != null ? String(meta.name) : '';
      if (!url && !name) {
        throw new BadRequestException(
          `Please upload a file for: ${question.prompt}`,
        );
      }
      const payload = {
        url,
        name: name || url,
        ...(meta?.mime != null ? { mime: String(meta.mime) } : {}),
        ...(meta?.size != null ? { size: Number(meta.size) } : {}),
      };
      return {
        ...base,
        valueJson: payload,
        valueText: payload.name || payload.url,
        ratingLabel: payload.name || payload.url,
      };
    }

    throw new BadRequestException(
      `Unsupported question type "${type}" for: ${question.prompt}`,
    );
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
    const answersByQuestionId = this.buildAnswersByQuestionId(dto.answers);

    const visibleQuestions = activeQuestions.filter((q: any) =>
      evaluateShowIf(this.questionShowIf(q), answersByQuestionId),
    );
    const visibleIds = new Set(
      visibleQuestions.map((q: any) => q.id as string),
    );

    for (const q of visibleQuestions) {
      if (!q.required) continue;
      if (!dto.answers.some((a) => a.questionId === q.id)) {
        throw new BadRequestException(`Please answer: ${q.prompt}`);
      }
    }

    for (const a of dto.answers) {
      if (!byId.has(a.questionId)) {
        throw new BadRequestException('Invalid question in submission.');
      }
      if (!visibleIds.has(a.questionId)) {
        throw new BadRequestException(
          'Answer submitted for a question that is not visible given your other answers.',
        );
      }
    }

    const answerCreates = dto.answers.map((a) =>
      this.buildAnswerPayload(user.tid, byId.get(a.questionId), a),
    );

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
          create: answerCreates,
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

  private formatAnswerDisplay(a: any): string {
    if (a.ratingLabel) return String(a.ratingLabel);
    if (a.rating != null) return String(a.rating);
    if (a.valueBool != null) return a.valueBool ? 'Yes' : 'No';
    if (a.valueNumber != null) return String(a.valueNumber);
    if (a.valueText) return String(a.valueText);
    if (a.valueDate) {
      return a.valueDate instanceof Date
        ? a.valueDate.toISOString()
        : String(a.valueDate);
    }
    if (Array.isArray(a.valueJson)) return a.valueJson.map(String).join(', ');
    if (a.valueJson && typeof a.valueJson === 'object') {
      const o = a.valueJson as { name?: string; url?: string; value?: unknown };
      if (o.name || o.url) return String(o.name || o.url);
      if (o.value != null) return String(o.value);
      try {
        return JSON.stringify(a.valueJson);
      } catch {
        return '';
      }
    }
    return '';
  }

  /** Admin: identity visible for tracking */
  async listResponses(tenantId: string, campaignId: string) {
    const campaign = await this.getCampaign(tenantId, campaignId);
    const rows = await this.db().feedbackResponse.findMany({
      where: { tenantId, campaignId },
      include: {
        answers: {
          include: {
            question: {
              select: { prompt: true, category: true, questionType: true },
            },
          },
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
          questionType: a.question?.questionType ?? 'LIKERT_5',
          rating: a.rating,
          ratingLabel: a.ratingLabel,
          valueText: a.valueText,
          valueNumber: a.valueNumber != null ? Number(a.valueNumber) : null,
          valueBool: a.valueBool,
          valueDate: a.valueDate,
          valueJson: a.valueJson,
          display: this.formatAnswerDisplay(a),
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
        ratingLabel: true,
        valueText: true,
        valueNumber: true,
        valueBool: true,
        valueDate: true,
        valueJson: true,
        question: {
          select: {
            prompt: true,
            category: true,
            sortOrder: true,
            questionType: true,
            options: true,
          },
        },
      },
    });
    const responseCount = await this.db().feedbackResponse.count({
      where: { tenantId, campaignId },
    });

    type Agg = {
      questionId: string;
      prompt: string;
      category: string;
      sortOrder: number;
      questionType: string;
      options: FeedbackOption[];
      dist: Map<string, { label: string; value: string; count: number }>;
      numbers: number[];
      sampleTexts: string[];
      n: number;
    };

    const byQuestion = new Map<string, Agg>();

    for (const a of answers) {
      const qType = a.question?.questionType ?? 'LIKERT_5';
      let row = byQuestion.get(a.questionId);
      if (!row) {
        const opts = Array.isArray(a.question?.options)
          ? (a.question!.options as FeedbackOption[])
          : defaultOptionsForType(qType);
        row = {
          questionId: a.questionId,
          prompt: a.question?.prompt ?? '',
          category: a.question?.category ?? 'OVERALL',
          sortOrder: a.question?.sortOrder ?? 0,
          questionType: qType,
          options: opts,
          dist: new Map(),
          numbers: [],
          sampleTexts: [],
          n: 0,
        };
        byQuestion.set(a.questionId, row);
      }
      row.n += 1;

      if (isObjectiveType(qType)) {
        const bump = (value: string, label: string) => {
          const key = value || label;
          const prev = row!.dist.get(key);
          if (prev) prev.count += 1;
          else row!.dist.set(key, { value: key, label, count: 1 });
        };

        if (qType === 'multi_choice' && Array.isArray(a.valueJson)) {
          for (const v of a.valueJson.map(String)) {
            const opt = row.options.find((o) => o.value === v || o.label === v);
            bump(opt?.value ?? v, opt?.label ?? v);
          }
        } else if (a.rating != null) {
          const opt = row.options.find(
            (o) => o.value === String(a.rating) || o.label === a.ratingLabel,
          );
          bump(
            opt?.value ?? String(a.rating),
            opt?.label ?? a.ratingLabel ?? ratingLabel(a.rating),
          );
        } else if (a.valueBool != null) {
          const value =
            qType === 'yes_no'
              ? a.valueBool
                ? 'yes'
                : 'no'
              : a.valueBool
                ? 'true'
                : 'false';
          const opt = row.options.find((o) => o.value === value);
          bump(value, opt?.label ?? (a.valueBool ? 'Yes' : 'No'));
        } else if (a.valueText) {
          const opt = row.options.find(
            (o) => o.value === a.valueText || o.label === a.valueText,
          );
          bump(
            opt?.value ?? a.valueText,
            opt?.label ?? a.ratingLabel ?? a.valueText,
          );
        } else if (a.ratingLabel) {
          bump(a.ratingLabel, a.ratingLabel);
        }
      }

      if (isNumericType(qType)) {
        const num =
          a.valueNumber != null
            ? Number(a.valueNumber)
            : a.rating != null
              ? Number(a.rating)
              : NaN;
        if (!Number.isNaN(num)) row.numbers.push(num);
      }

      if (isTextType(qType) || qType === 'time') {
        const text = a.valueText?.trim();
        if (text && row.sampleTexts.length < 50) row.sampleTexts.push(text);
      }
    }

    // Ensure campaign questions with zero answers still appear
    for (const q of campaign.questions ?? []) {
      if (!byQuestion.has(q.id)) {
        byQuestion.set(q.id, {
          questionId: q.id,
          prompt: q.prompt,
          category: q.category,
          sortOrder: q.sortOrder,
          questionType: q.questionType ?? 'LIKERT_5',
          options: this.questionOptions(q),
          dist: new Map(),
          numbers: [],
          sampleTexts: [],
          n: 0,
        });
      }
    }

    const questions = [...byQuestion.values()]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((q) => {
        const base = {
          questionId: q.questionId,
          prompt: q.prompt,
          category: q.category,
          questionType: q.questionType,
          responseCount: q.n,
        };

        if (isObjectiveType(q.questionType)) {
          // Seed known options so zeros show in distribution
          for (const opt of q.options) {
            if (!q.dist.has(opt.value)) {
              q.dist.set(opt.value, {
                value: opt.value,
                label: opt.label,
                count: 0,
              });
            }
          }
          const distribution = [...q.dist.values()].map((d) => ({
            value: d.value,
            label: d.label,
            count: d.count,
            percent: q.n > 0 ? Math.round((d.count / q.n) * 1000) / 10 : 0,
            // backward compat for LIKERT UI
            rating: Number.isFinite(Number(d.value))
              ? Number(d.value)
              : undefined,
          }));
          const avg =
            q.numbers.length > 0
              ? Math.round(
                  (q.numbers.reduce((s, n) => s + n, 0) / q.numbers.length) *
                    100,
                ) / 100
              : null;
          return {
            ...base,
            average: avg,
            distribution,
          };
        }

        if (
          isNumericType(q.questionType) ||
          q.questionType === 'integer' ||
          q.questionType === 'decimal'
        ) {
          const nums = q.numbers;
          return {
            ...base,
            min: nums.length ? Math.min(...nums) : null,
            max: nums.length ? Math.max(...nums) : null,
            average: nums.length
              ? Math.round(
                  (nums.reduce((s, n) => s + n, 0) / nums.length) * 100,
                ) / 100
              : null,
          };
        }

        if (isTextType(q.questionType) || q.questionType === 'time') {
          return {
            ...base,
            sampleTexts: q.sampleTexts.slice(0, 50),
          };
        }

        // date / datetime / file_upload — light summary
        return {
          ...base,
          sampleTexts: q.sampleTexts.slice(0, 50),
          answeredCount: q.n,
        };
      });

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

  async exportXlsx(tenantId: string, campaignId: string): Promise<Buffer> {
    const [analytics, responses, campaign] = await Promise.all([
      this.analytics(tenantId, campaignId),
      this.listResponses(tenantId, campaignId),
      this.getCampaign(tenantId, campaignId),
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'NAAC IQAC Feedback';
    workbook.created = new Date();

    const summary = workbook.addWorksheet('Summary');
    summary.addRow(['Campaign', campaign.title]);
    summary.addRow(['Academic year', campaign.academicYear]);
    summary.addRow(['Audience', campaign.audience]);
    summary.addRow(['Response count', analytics.responseCount]);
    summary.addRow([]);
    summary.addRow([
      'Question',
      'Type',
      'Category',
      'Responses',
      'Average / Summary',
      'Distribution',
    ]);

    for (const q of analytics.questions as any[]) {
      let summaryText = '';
      if (q.average != null) summaryText = `avg=${q.average}`;
      if (q.min != null || q.max != null) {
        summaryText = [
          q.min != null ? `min=${q.min}` : '',
          q.max != null ? `max=${q.max}` : '',
          q.average != null ? `avg=${q.average}` : '',
        ]
          .filter(Boolean)
          .join(', ');
      }
      if (Array.isArray(q.sampleTexts) && q.sampleTexts.length) {
        summaryText = `${q.sampleTexts.length} text sample(s)`;
      }
      const dist = Array.isArray(q.distribution)
        ? q.distribution
            .map(
              (d: any) =>
                `${d.label ?? d.value}: ${d.count}${d.percent != null ? ` (${d.percent}%)` : ''}`,
            )
            .join('; ')
        : '';
      summary.addRow([
        q.prompt,
        q.questionType,
        q.category,
        q.responseCount,
        summaryText,
        dist,
      ]);
    }

    const sheet = workbook.addWorksheet('Responses');
    const questions = [...(campaign.questions ?? [])].sort(
      (a: any, b: any) => a.sortOrder - b.sortOrder,
    );
    const header = [
      'Response ID',
      'Submitted At',
      'Respondent',
      'Code',
      'Department',
      'Email',
      'Programme',
      'Semester',
      ...questions.map((q: any) => q.prompt),
    ];
    sheet.addRow(header);

    for (const r of responses) {
      const byQ = new Map(
        r.answers.map((a: any) => [a.questionId as string, a]),
      );
      sheet.addRow([
        r.id,
        r.submittedAt ? new Date(r.submittedAt).toISOString() : '',
        r.respondent?.name ?? '',
        r.respondent?.code ?? '',
        r.respondent?.department ?? '',
        r.respondent?.email ?? '',
        r.programmeHint ?? '',
        r.semesterNo ?? '',
        ...questions.map((q: any) => {
          const a = byQ.get(q.id);
          return a ? this.formatAnswerDisplay(a) : '';
        }),
      ]);
    }

    const buf = await workbook.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  async exportPdf(tenantId: string, campaignId: string): Promise<Buffer> {
    const [analytics, campaign] = await Promise.all([
      this.analytics(tenantId, campaignId),
      this.getCampaign(tenantId, campaignId),
    ]);

    const escape = (s: string) =>
      String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const questionBlocks = (analytics.questions as any[])
      .map((q) => {
        let body = `<p><em>${q.responseCount ?? 0} response(s)</em></p>`;
        if (q.average != null) {
          body += `<p>Average: <strong>${escape(String(q.average))}</strong>`;
          if (q.min != null || q.max != null) {
            body += ` (min ${escape(String(q.min ?? '—'))}, max ${escape(String(q.max ?? '—'))})`;
          }
          body += `</p>`;
        }
        if (Array.isArray(q.distribution) && q.distribution.length) {
          body +=
            '<ul>' +
            q.distribution
              .map(
                (d: any) =>
                  `<li>${escape(String(d.label ?? d.value))}: ${d.count}${
                    d.percent != null ? ` (${d.percent}%)` : ''
                  }</li>`,
              )
              .join('') +
            '</ul>';
        }
        if (Array.isArray(q.sampleTexts) && q.sampleTexts.length) {
          body +=
            '<p>Sample answers:</p><ul>' +
            q.sampleTexts
              .slice(0, 20)
              .map((t: string) => `<li>${escape(t)}</li>`)
              .join('') +
            '</ul>';
        }
        return `<section style="margin-bottom:16px"><h3 style="margin:0 0 6px;font-size:12pt">${escape(
          q.prompt,
        )}</h3><p style="margin:0 0 6px;color:#555;font-size:9pt">${escape(
          q.questionType,
        )} · ${escape(q.category)}</p>${body}</section>`;
      })
      .join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escape(
      campaign.title,
    )}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; font-size: 11pt; color: #111; margin: 24px; }
  h1 { font-size: 18pt; margin: 0 0 4px; }
  .meta { color: #444; margin-bottom: 20px; font-size: 10pt; }
</style></head><body>
  <h1>${escape(campaign.title)}</h1>
  <div class="meta">
    Academic year: ${escape(campaign.academicYear)} · Audience: ${escape(
      campaign.audience,
    )} · Responses: ${analytics.responseCount}<br/>
    Generated: ${escape(new Date().toISOString())}
  </div>
  ${questionBlocks || '<p>No questions.</p>'}
  <p style="margin-top:24px;font-size:9pt;color:#666">${escape(analytics.note)}</p>
</body></html>`;

    // pdfkit is not a dependency; puppeteer is available in this API.
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load', timeout: 60_000 });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  scale() {
    return FEEDBACK_LIKERT_5;
  }
}

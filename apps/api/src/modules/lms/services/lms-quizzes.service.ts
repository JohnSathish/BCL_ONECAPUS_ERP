import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import type {
  CreateLmsQuizDto,
  CreateLmsQuizQuestionDto,
  SubmitLmsQuizAttemptDto,
  UpdateLmsQuizDto,
} from '../dto/lms.dto';
import { LmsAccessService } from './lms-access.service';
import { LmsAuditService } from './lms-audit.service';

@Injectable()
export class LmsQuizzesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: LmsAccessService,
    private readonly audit: LmsAuditService,
  ) {}

  private canManage(user: JwtUser): boolean {
    return (
      user.permissions.includes('lms:assignments:manage') ||
      this.access.hasAdminLms(user)
    );
  }

  async list(user: JwtUser, workspaceId: string) {
    await this.access.assertWorkspaceAccess(user, workspaceId, 'read');
    const studentView = user.roles.includes('student');
    const quizzes = await this.prisma.lmsQuiz.findMany({
      where: {
        tenantId: user.tid,
        workspaceId,
        deletedAt: null,
        ...(studentView ? { status: 'PUBLISHED' } : {}),
      },
      include: {
        createdBy: { select: { id: true, displayName: true, email: true } },
        _count: { select: { questions: true, attempts: true } },
      },
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
    });

    if (!studentView) return quizzes;

    const studentId = await this.access.getStudentId(user);
    if (!studentId) return quizzes;

    const attempts = await this.prisma.lmsQuizAttempt.findMany({
      where: {
        tenantId: user.tid,
        studentId,
        quizId: { in: quizzes.map((quiz) => quiz.id) },
      },
      orderBy: { attemptNo: 'desc' },
    });
    const latestByQuiz = new Map<string, (typeof attempts)[number]>();
    for (const attempt of attempts) {
      if (!latestByQuiz.has(attempt.quizId))
        latestByQuiz.set(attempt.quizId, attempt);
    }

    return quizzes.map((quiz) => ({
      ...quiz,
      myAttempt: latestByQuiz.get(quiz.id) ?? null,
    }));
  }

  async create(user: JwtUser, workspaceId: string, dto: CreateLmsQuizDto) {
    await this.access.assertWorkspaceAccess(user, workspaceId, 'upload');
    if (!this.canManage(user))
      throw new ForbiddenException('Missing lms:assignments:manage permission');

    const quiz = await this.prisma.lmsQuiz.create({
      data: {
        tenantId: user.tid,
        workspaceId,
        title: dto.title,
        instructions: dto.instructions,
        timeLimitMinutes: dto.timeLimitMinutes,
        maxAttempts: dto.maxAttempts ?? 1,
        maxMarks: dto.maxMarks,
        shuffleQuestions: dto.shuffleQuestions ?? false,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        status: 'DRAFT',
        createdById: user.sub,
      },
    });

    await this.audit.log({
      tenantId: user.tid,
      workspaceId,
      entityType: 'QUIZ',
      entityId: quiz.id,
      action: 'CREATE',
      actorId: user.sub,
    });

    return quiz;
  }

  async update(user: JwtUser, quizId: string, dto: UpdateLmsQuizDto) {
    const quiz = await this.getQuizOrThrow(user.tid, quizId);
    await this.access.assertWorkspaceAccess(user, quiz.workspaceId, 'upload');
    if (!this.canManage(user))
      throw new ForbiddenException('Missing lms:assignments:manage permission');

    return this.prisma.lmsQuiz.update({
      where: { id: quizId },
      data: {
        title: dto.title,
        instructions: dto.instructions,
        timeLimitMinutes: dto.timeLimitMinutes,
        maxAttempts: dto.maxAttempts,
        maxMarks: dto.maxMarks,
        shuffleQuestions: dto.shuffleQuestions,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
      },
    });
  }

  async addQuestion(
    user: JwtUser,
    quizId: string,
    dto: CreateLmsQuizQuestionDto,
  ) {
    const quiz = await this.getQuizOrThrow(user.tid, quizId);
    await this.access.assertWorkspaceAccess(user, quiz.workspaceId, 'upload');
    if (!this.canManage(user))
      throw new ForbiddenException('Missing lms:assignments:manage permission');

    const count = await this.prisma.lmsQuizQuestion.count({
      where: { quizId },
    });
    return this.prisma.lmsQuizQuestion.create({
      data: {
        tenantId: user.tid,
        quizId,
        prompt: dto.prompt,
        questionType: dto.questionType ?? 'MCQ',
        options: dto.options ?? [],
        correctAnswer: dto.correctAnswer,
        marks: dto.marks ?? 1,
        sortOrder: dto.sortOrder ?? count,
      },
    });
  }

  async publish(user: JwtUser, quizId: string) {
    const quiz = await this.getQuizOrThrow(user.tid, quizId);
    await this.access.assertWorkspaceAccess(user, quiz.workspaceId, 'upload');
    if (!this.canManage(user))
      throw new ForbiddenException('Missing lms:assignments:manage permission');

    const questionCount = await this.prisma.lmsQuizQuestion.count({
      where: { quizId },
    });
    if (questionCount === 0)
      throw new BadRequestException(
        'Add at least one question before publishing',
      );

    return this.prisma.lmsQuiz.update({
      where: { id: quizId },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });
  }

  async close(user: JwtUser, quizId: string) {
    const quiz = await this.getQuizOrThrow(user.tid, quizId);
    await this.access.assertWorkspaceAccess(user, quiz.workspaceId, 'upload');
    if (!this.canManage(user))
      throw new ForbiddenException('Missing lms:assignments:manage permission');

    return this.prisma.lmsQuiz.update({
      where: { id: quizId },
      data: { status: 'CLOSED', closedAt: new Date() },
    });
  }

  async listQuestions(user: JwtUser, quizId: string, includeAnswers = false) {
    const quiz = await this.getQuizOrThrow(user.tid, quizId);
    await this.access.assertWorkspaceAccess(user, quiz.workspaceId, 'read');

    const questions = await this.prisma.lmsQuizQuestion.findMany({
      where: { tenantId: user.tid, quizId },
      orderBy: { sortOrder: 'asc' },
    });

    if (includeAnswers && this.canManage(user)) return questions;

    return questions.map((question) => ({
      id: question.id,
      prompt: question.prompt,
      questionType: question.questionType,
      options: question.options,
      marks: question.marks,
      sortOrder: question.sortOrder,
    }));
  }

  async startAttempt(user: JwtUser, quizId: string) {
    const quiz = await this.getQuizOrThrow(user.tid, quizId);
    await this.access.assertWorkspaceAccess(user, quiz.workspaceId, 'read');
    if (quiz.status !== 'PUBLISHED')
      throw new BadRequestException('Quiz is not open');

    const studentId = await this.access.getStudentId(user);
    if (!studentId) throw new ForbiddenException('Student profile required');

    const existingCount = await this.prisma.lmsQuizAttempt.count({
      where: { tenantId: user.tid, quizId, studentId },
    });
    if (existingCount >= quiz.maxAttempts) {
      throw new BadRequestException('Maximum quiz attempts reached');
    }

    const questions = await this.prisma.lmsQuizQuestion.findMany({
      where: { tenantId: user.tid, quizId },
      orderBy: { sortOrder: 'asc' },
    });
    const orderedQuestions = quiz.shuffleQuestions
      ? [...questions].sort(() => Math.random() - 0.5)
      : questions;
    const maxScore = questions.reduce(
      (sum, question) => sum + Number(question.marks),
      0,
    );

    const attempt = await this.prisma.lmsQuizAttempt.create({
      data: {
        tenantId: user.tid,
        quizId,
        studentId,
        attemptNo: existingCount + 1,
        status: 'IN_PROGRESS',
        maxScore,
      },
    });

    return {
      attempt,
      timeLimitMinutes: quiz.timeLimitMinutes,
      questions: orderedQuestions.map((question) => ({
        id: question.id,
        prompt: question.prompt,
        questionType: question.questionType,
        options: question.options,
        marks: question.marks,
        sortOrder: question.sortOrder,
      })),
    };
  }

  async submitAttempt(
    user: JwtUser,
    attemptId: string,
    dto: SubmitLmsQuizAttemptDto,
  ) {
    const attempt = await this.prisma.lmsQuizAttempt.findFirst({
      where: { tenantId: user.tid, id: attemptId },
      include: { quiz: true },
    });
    if (!attempt) throw new NotFoundException('Quiz attempt not found');
    if (attempt.status !== 'IN_PROGRESS')
      throw new BadRequestException('Attempt already submitted');

    const studentId = await this.access.getStudentId(user);
    const isOwner = studentId && attempt.studentId === studentId;
    if (!isOwner && !this.canManage(user))
      throw new ForbiddenException('Not allowed');

    if (attempt.quiz?.timeLimitMinutes && attempt.startedAt) {
      const elapsedMs = Date.now() - new Date(attempt.startedAt).getTime();
      const limitMs = attempt.quiz.timeLimitMinutes * 60_000;
      if (elapsedMs > limitMs + 30_000) {
        throw new BadRequestException('Quiz time limit exceeded');
      }
    }

    const questions = await this.prisma.lmsQuizQuestion.findMany({
      where: { tenantId: user.tid, quizId: attempt.quizId },
    });
    const questionById = new Map(
      questions.map((question) => [question.id, question]),
    );

    let score = 0;
    for (const entry of dto.answers ?? []) {
      const question = questionById.get(entry.questionId);
      if (!question) continue;
      const isCorrect =
        question.correctAnswer != null &&
        String(entry.answer).trim().toLowerCase() ===
          String(question.correctAnswer).trim().toLowerCase();
      const marksAwarded = isCorrect ? Number(question.marks) : 0;
      score += marksAwarded;
      await this.prisma.lmsQuizAnswer.create({
        data: {
          tenantId: user.tid,
          attemptId,
          questionId: entry.questionId,
          answer: entry.answer,
          isCorrect,
          marksAwarded,
        },
      });
    }

    return this.prisma.lmsQuizAttempt.update({
      where: { id: attemptId },
      data: {
        status: 'SUBMITTED',
        score,
        submittedAt: new Date(),
      },
    });
  }

  async listAttempts(user: JwtUser, quizId: string) {
    const quiz = await this.getQuizOrThrow(user.tid, quizId);
    await this.access.assertWorkspaceAccess(user, quiz.workspaceId, 'read');
    if (!this.canManage(user))
      throw new ForbiddenException('Missing lms:assignments:manage permission');

    return this.prisma.lmsQuizAttempt.findMany({
      where: { tenantId: user.tid, quizId },
      include: {
        student: {
          select: {
            enrollmentNumber: true,
            masterProfile: { select: { fullName: true } },
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });
  }

  private async getQuizOrThrow(tenantId: string, quizId: string) {
    const quiz = await this.prisma.lmsQuiz.findFirst({
      where: { tenantId, id: quizId, deletedAt: null },
    });
    if (!quiz) throw new NotFoundException('Quiz not found');
    return quiz;
  }
}

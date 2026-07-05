import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { AiAuditService } from './ai-audit.service';
import { AiSessionStore } from './ai-session.store';
import { AiToolsService } from './ai-tools.service';
import type {
  AiActiveStudent,
  AiChatResponse,
  AiPendingIntent,
  AiSessionState,
  ResolvedIntent,
} from './ai-assistant.types';
import { HybridIntentResolver } from './intent/hybrid-intent.resolver';
import { LlmIntentAdapter } from './intent/llm-intent.adapter';

@Injectable()
export class AiAssistantService {
  constructor(
    private readonly sessions: AiSessionStore,
    private readonly intents: HybridIntentResolver,
    private readonly llm: LlmIntentAdapter,
    private readonly tools: AiToolsService,
    private readonly audit: AiAuditService,
  ) {}

  async chat(
    user: JwtUser,
    question: string,
    sessionId?: string,
  ): Promise<AiChatResponse> {
    const { sessionId: sid, state } = await this.sessions.getOrCreate(
      user.tid,
      user.sub,
      sessionId,
    );

    if (
      state.pendingConfirmation &&
      !state.pendingConfirmation.proposedAction?.startsWith('report') &&
      /^(yes|confirm|ok|okay|proceed|go ahead)\b/i.test(question.trim())
    ) {
      return this.confirm(user, sid, state.pendingConfirmation.confirmationId);
    }

    if (
      state.pendingIntent?.awaitingReportConfirm &&
      this.isReportConfirmPhrase(question)
    ) {
      return this.confirmReport(user, sid, question);
    }

    let intent = this.intents.resolve(
      question,
      state.pendingIntent,
      state.activeStudent,
    );
    if (intent.confidence < 0.55 && this.llm.enabled()) {
      const llmIntent = await this.llm.resolve(question, state.pendingIntent);
      if (llmIntent && llmIntent.confidence >= intent.confidence) {
        intent = llmIntent;
      }
    }

    if (intent.needsClarification?.length) {
      const pending: AiPendingIntent = {
        action:
          intent.action === 'help' || intent.action === 'clarify'
            ? 'generate_student_report'
            : (intent.action as AiPendingIntent['action']),
        filters: intent.filters,
        columns: intent.columns,
        format: intent.format,
        missing: intent.needsClarification,
        searchQuery: intent.searchQuery,
        chartWidgetId: intent.chartWidgetId,
        feeReportType: intent.feeReportType,
        attendanceReportType: intent.attendanceReportType,
        proposedAction: intent.proposedAction,
        actionHref: intent.actionHref,
        actionLabel: intent.actionLabel,
        lookupFocus: intent.lookupFocus,
      };
      const response = this.tools.clarificationResponse(intent);
      await this.persistTurn(
        user,
        sid,
        state,
        question,
        response.answer,
        pending,
        state.pendingConfirmation ?? null,
        state.activeStudent ?? null,
      );
      await this.audit.log({
        tenantId: user.tid,
        userId: user.sub,
        sessionId: sid,
        question,
        intent,
        resultSummary: 'clarification',
      });
      return { ...response, sessionId: sid, source: intent.source ?? 'rules' };
    }

    const result = (await this.tools.execute(user, intent, sid)) as Omit<
      AiChatResponse,
      'sessionId'
    > & {
      _confirmationMeta?: AiSessionState['pendingConfirmation'];
      _activeStudent?: AiActiveStudent | null;
      _pendingReportIntent?: AiPendingIntent;
    };

    let pendingConfirmation = state.pendingConfirmation ?? null;
    if (result._confirmationMeta) {
      pendingConfirmation = result._confirmationMeta;
    } else if (intent.action !== 'propose_action') {
      pendingConfirmation = null;
    }

    let pendingIntent: AiPendingIntent | null = null;
    if (result._pendingReportIntent) {
      pendingIntent = result._pendingReportIntent;
    } else if (intent.needsClarification?.length) {
      // handled above — should not reach here
    } else if (intent.reportConfirmed) {
      pendingIntent = null;
    }

    let activeStudent = state.activeStudent ?? null;
    if (result._activeStudent !== undefined) {
      activeStudent = result._activeStudent;
    }

    const {
      _confirmationMeta: _c,
      _activeStudent: _a,
      _pendingReportIntent: _p,
      ...publicResult
    } = result;

    const answerWithContext =
      activeStudent && intent.action === 'lookup_student'
        ? publicResult.answer
        : publicResult.answer;

    await this.persistTurn(
      user,
      sid,
      { ...state, pendingConfirmation, activeStudent, pendingIntent },
      question,
      answerWithContext,
      pendingIntent,
      pendingConfirmation,
      activeStudent,
    );
    await this.audit.log({
      tenantId: user.tid,
      userId: user.sub,
      sessionId: sid,
      question,
      intent: { ...intent, activeStudent },
      tools: [intent.action],
      resultSummary: answerWithContext.slice(0, 500),
    });
    return {
      ...publicResult,
      answer: answerWithContext,
      sessionId: sid,
      source: intent.source ?? publicResult.source,
    };
  }

  async selectFields(
    user: JwtUser,
    sessionId: string,
    columns: string[],
    format?: 'xlsx' | 'csv' | 'pdf',
  ): Promise<AiChatResponse> {
    const { sessionId: sid, state } = await this.sessions.getOrCreate(
      user.tid,
      user.sub,
      sessionId,
    );
    const pending = state.pendingIntent;
    const question = `Generate report with columns: ${columns.join(', ')}`;
    const intent: ResolvedIntent = {
      action: 'generate_student_report',
      filters: pending?.filters ?? {},
      columns,
      format: format === 'pdf' ? 'xlsx' : (format ?? pending?.format ?? 'xlsx'),
      confidence: 1,
      reportConfirmed: true,
    };
    const result = await this.tools.execute(user, intent, sid);
    await this.persistTurn(
      user,
      sid,
      state,
      question,
      result.answer,
      null,
      state.pendingConfirmation ?? null,
      state.activeStudent ?? null,
    );
    await this.audit.log({
      tenantId: user.tid,
      userId: user.sub,
      sessionId: sid,
      question,
      intent,
      tools: ['generate_student_report'],
      resultSummary: result.answer.slice(0, 500),
    });
    return { ...result, sessionId: sid };
  }

  async confirmReport(
    user: JwtUser,
    sessionId: string,
    question = 'confirm report',
  ): Promise<AiChatResponse> {
    const { sessionId: sid, state } = await this.sessions.getOrCreate(
      user.tid,
      user.sub,
      sessionId,
    );
    const pending = state.pendingIntent;
    if (
      !pending ||
      pending.action !== 'generate_student_report' ||
      !pending.awaitingReportConfirm
    ) {
      throw new BadRequestException(
        'No student report preview is waiting for confirmation. Ask for a report first.',
      );
    }

    const intent: ResolvedIntent = {
      action: 'generate_student_report',
      filters: pending.filters,
      columns: pending.columns,
      format: pending.format === 'pdf' ? 'xlsx' : (pending.format ?? 'xlsx'),
      reportConfirmed: true,
      confidence: 1,
    };

    const result = (await this.tools.execute(user, intent, sid)) as Omit<
      AiChatResponse,
      'sessionId'
    > & { _pendingReportIntent?: AiPendingIntent };

    await this.persistTurn(
      user,
      sid,
      { ...state, pendingIntent: null },
      question,
      result.answer,
      null,
      state.pendingConfirmation ?? null,
      state.activeStudent ?? null,
    );
    await this.audit.log({
      tenantId: user.tid,
      userId: user.sub,
      sessionId: sid,
      question,
      intent,
      tools: ['generate_student_report'],
      resultSummary: result.answer.slice(0, 500),
    });
    return { ...result, sessionId: sid };
  }

  async confirm(
    user: JwtUser,
    sessionId: string,
    confirmationId: string,
  ): Promise<AiChatResponse> {
    const { sessionId: sid, state } = await this.sessions.getOrCreate(
      user.tid,
      user.sub,
      sessionId,
    );
    const pending = state.pendingConfirmation;
    if (!pending || pending.confirmationId !== confirmationId) {
      throw new BadRequestException(
        'No matching pending action to confirm. Ask again to start a new confirmation.',
      );
    }

    const answer = `Confirmed: ${pending.actionLabel}. Opening the module — complete the action there. This confirmation was recorded in the AI audit log.`;
    await this.persistTurn(
      user,
      sid,
      state,
      'confirm',
      answer,
      null,
      null,
      state.activeStudent ?? null,
    );
    await this.audit.log({
      tenantId: user.tid,
      userId: user.sub,
      sessionId: sid,
      question: 'confirm',
      intent: pending,
      tools: ['confirm_action'],
      resultSummary: answer,
    });

    return {
      answer,
      sessionId: sid,
      source: 'rules',
      links: [{ label: pending.actionLabel, href: pending.actionHref }],
      suggestedFollowUps: [
        'How many students have pending fees?',
        'Generate student report',
      ],
    };
  }

  private async persistTurn(
    user: JwtUser,
    sessionId: string,
    state: AiSessionState,
    question: string,
    answer: string,
    pending: AiPendingIntent | null,
    pendingConfirmation: AiSessionState['pendingConfirmation'] = null,
    activeStudent: AiActiveStudent | null = null,
  ) {
    const next: AiSessionState = {
      ...state,
      pendingIntent: pending,
      pendingConfirmation,
      activeStudent,
      turns: [
        ...state.turns,
        { role: 'user', text: question },
        { role: 'assistant', text: answer },
      ],
      updatedAt: new Date().toISOString(),
    };
    await this.sessions.save(user.tid, user.sub, sessionId, next);
  }

  newSessionId() {
    return randomUUID();
  }

  private isReportConfirmPhrase(question: string) {
    const lower = question.trim().toLowerCase();
    return (
      /^(yes|confirm|ok|okay|proceed|go ahead|generate)(\b|,|\s|$)/i.test(
        lower,
      ) ||
      /\bgenerate\s+(the\s+)?report\b/i.test(lower) ||
      /^yes,?\s+generate\b/i.test(lower)
    );
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AiPendingIntent, ResolvedIntent } from '../ai-assistant.types';

const TOOL_NAMES = [
  'lookup_student',
  'get_institutional_kpis',
  'fee_summary',
  'attendance_summary',
  'search_students',
  'search_staff',
  'search_applications',
  'search_subjects',
  'search_departments',
  'generate_student_report',
  'generate_fee_report',
  'generate_attendance_report',
  'generate_chart',
  'propose_action',
] as const;

@Injectable()
export class LlmIntentAdapter {
  private readonly logger = new Logger(LlmIntentAdapter.name);

  constructor(private readonly config: ConfigService) {}

  enabled() {
    return Boolean(this.config.get<string>('AI_ASSISTANT_LLM_API_KEY')?.trim());
  }

  async resolve(
    question: string,
    pending?: AiPendingIntent | null,
  ): Promise<ResolvedIntent | null> {
    if (!this.enabled()) return null;

    const apiKey = this.config.get<string>('AI_ASSISTANT_LLM_API_KEY')!.trim();
    const baseUrl = (
      this.config.get<string>('AI_ASSISTANT_LLM_BASE_URL') ??
      'https://api.openai.com/v1'
    ).replace(/\/$/, '');
    const model =
      this.config.get<string>('AI_ASSISTANT_LLM_MODEL') ?? 'gpt-4o-mini';

    const system = `You are OneCampus AI intent classifier for a college ERP.
Return ONLY valid JSON matching:
{"action":"<tool>","confidence":0-1,"searchQuery":"","lookupFocus":"shift|programme|semester|fee|attendance|profile|who","columns":[],"format":"xlsx|csv|pdf","programmeFamily":"BA|BSC|BCOM","semester":null,"gender":"MALE|FEMALE","chartWidgetId":"department-admissions|fee-collection-trend|shift-attendance","feeReportType":"outstanding|daily-collection|monthly-collection","attendanceReportType":"shortage|daily","proposedAction":"sms|email|promote|certificates","actionHref":"","actionLabel":""}
Tools: ${TOOL_NAMES.join(', ')}.
When the user mentions a roll/admission number like BA25-814, use action lookup_student with searchQuery set to that code and lookupFocus for the field asked (shift, programme, fee, attendance, profile).
Never invent SQL. Prefer generate_student_report for student lists/exports.
For write actions (sms, email, promote, certificates) use propose_action.`;

    const userContent = pending
      ? `Pending intent: ${JSON.stringify(pending)}\nUser follow-up: ${question}`
      : question;

    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: userContent },
          ],
        }),
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) {
        this.logger.warn(`LLM intent HTTP ${res.status}`);
        return null;
      }
      const body = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = body.choices?.[0]?.message?.content;
      if (!content) return null;
      const parsed = JSON.parse(content) as Record<string, unknown>;
      return this.mapParsed(parsed);
    } catch (err) {
      this.logger.warn(
        `LLM intent failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  private mapParsed(parsed: Record<string, unknown>): ResolvedIntent | null {
    const action = String(parsed.action ?? '');
    if (!TOOL_NAMES.includes(action as (typeof TOOL_NAMES)[number])) {
      return null;
    }
    const filters: ResolvedIntent['filters'] = {};
    if (
      parsed.programmeFamily === 'BA' ||
      parsed.programmeFamily === 'BSC' ||
      parsed.programmeFamily === 'BCOM'
    ) {
      filters.programmeFamily = parsed.programmeFamily;
    }
    if (typeof parsed.semester === 'number') filters.semester = parsed.semester;
    if (parsed.gender === 'MALE' || parsed.gender === 'FEMALE') {
      filters.gender = parsed.gender;
    }

    const format =
      parsed.format === 'csv' ||
      parsed.format === 'pdf' ||
      parsed.format === 'xlsx'
        ? parsed.format
        : undefined;

    return {
      action: action as ResolvedIntent['action'],
      filters,
      columns: Array.isArray(parsed.columns)
        ? parsed.columns.map(String)
        : undefined,
      format,
      searchQuery:
        typeof parsed.searchQuery === 'string' && parsed.searchQuery.trim()
          ? parsed.searchQuery.trim()
          : undefined,
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.7)),
      chartWidgetId:
        typeof parsed.chartWidgetId === 'string'
          ? parsed.chartWidgetId
          : undefined,
      feeReportType:
        typeof parsed.feeReportType === 'string'
          ? parsed.feeReportType
          : undefined,
      attendanceReportType:
        typeof parsed.attendanceReportType === 'string'
          ? parsed.attendanceReportType
          : undefined,
      proposedAction:
        typeof parsed.proposedAction === 'string'
          ? parsed.proposedAction
          : undefined,
      actionHref:
        typeof parsed.actionHref === 'string' ? parsed.actionHref : undefined,
      actionLabel:
        typeof parsed.actionLabel === 'string' ? parsed.actionLabel : undefined,
      lookupFocus: [
        'shift',
        'programme',
        'semester',
        'fee',
        'attendance',
        'profile',
        'who',
      ].includes(String(parsed.lookupFocus))
        ? (parsed.lookupFocus as import('../ai-assistant.types').AiLookupFocus)
        : undefined,
      source: 'llm',
    };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';
import { SupportFaqService } from './support-faq.service';

export type SupportAiAssistResult = {
  summary: string;
  suggestedReply: string;
  sentiment: 'Frustrated' | 'Happy' | 'Urgent' | 'Neutral' | 'Confused';
  suggestedCategory: string;
  suggestedPriority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  confidence: number;
  faqHints: Array<{ id: string; question: string }>;
  note?: string;
};

@Injectable()
export class SupportAiService {
  private readonly logger = new Logger(SupportAiService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly faq: SupportFaqService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  enabled() {
    return Boolean(this.config.get<string>('AI_ASSISTANT_LLM_API_KEY')?.trim());
  }

  async assistThread(
    tenantId: string,
    threadId: string,
  ): Promise<SupportAiAssistResult> {
    const thread = await this.db().supportChatThread.findFirst({
      where: { id: threadId, tenantId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 40,
          select: {
            senderRole: true,
            bodyOriginal: true,
            bodyTranslated: true,
          },
        },
      },
    });
    if (!thread) {
      return this.empty('Chat not found');
    }

    const transcript = (thread.messages ?? [])
      .map(
        (m: {
          senderRole: string;
          bodyOriginal: string;
          bodyTranslated?: string | null;
        }) => `${m.senderRole}: ${m.bodyTranslated || m.bodyOriginal}`,
      )
      .join('\n');

    const faqHints = await this.faqHints(tenantId, transcript);
    if (!this.enabled()) {
      return {
        ...this.heuristic(thread.category, transcript),
        faqHints,
        note: 'AI is not configured (set AI_ASSISTANT_LLM_API_KEY). Showing heuristic suggestions. Chat translation still uses the free offline Garo/Khasi phrase dictionary when phrases match.',
      };
    }

    try {
      const llm = await this.callLlm(transcript, thread.category);
      return { ...llm, faqHints };
    } catch (err) {
      this.logger.warn(
        `AI assist failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return {
        ...this.heuristic(thread.category, transcript),
        faqHints,
        note: 'AI assist failed. Showing heuristic suggestions.',
      };
    }
  }

  private async faqHints(tenantId: string, transcript: string) {
    const q = transcript.slice(0, 120);
    try {
      const cats = await this.faq.listPublished(tenantId, q);
      return (cats ?? [])
        .flatMap(
          (c: { articles?: Array<{ id: string; question: string }> }) =>
            c.articles ?? [],
        )
        .slice(0, 4)
        .map((a: { id: string; question: string }) => ({
          id: a.id,
          question: a.question,
        }));
    } catch {
      return [];
    }
  }

  private heuristic(
    category: string,
    transcript: string,
  ): SupportAiAssistResult {
    const lower = transcript.toLowerCase();
    let sentiment: SupportAiAssistResult['sentiment'] = 'Neutral';
    if (
      /urgent|asap|immediately|not showing|failed|angry|frustrated/.test(lower)
    ) {
      sentiment = 'Urgent';
    } else if (/thank|thanks|grateful|appreciate/.test(lower)) {
      sentiment = 'Happy';
    } else if (/how|where|cannot|can't|unable|confusion|confused/.test(lower)) {
      sentiment = 'Confused';
    } else if (/wait|delay|still|again/.test(lower)) {
      sentiment = 'Frustrated';
    }

    const priority =
      sentiment === 'Urgent'
        ? 'URGENT'
        : sentiment === 'Frustrated'
          ? 'HIGH'
          : 'MEDIUM';

    return {
      summary:
        transcript.trim().length > 0
          ? `Student enquiry about ${String(category || 'GENERAL')
              .toLowerCase()
              .replace(/_/g, ' ')}.`
          : 'No messages yet.',
      suggestedReply:
        'Thank you for contacting Support Centre. We have noted your request and will update you within two working days. Please share your roll number if not already provided.',
      sentiment,
      suggestedCategory: category || 'GENERAL',
      suggestedPriority: priority,
      confidence: 55,
      faqHints: [],
    };
  }

  private empty(note: string): SupportAiAssistResult {
    return {
      summary: '',
      suggestedReply: '',
      sentiment: 'Neutral',
      suggestedCategory: 'GENERAL',
      suggestedPriority: 'MEDIUM',
      confidence: 0,
      faqHints: [],
      note,
    };
  }

  private async callLlm(
    transcript: string,
    category: string,
  ): Promise<Omit<SupportAiAssistResult, 'faqHints'>> {
    const apiKey = this.config.get<string>('AI_ASSISTANT_LLM_API_KEY')!.trim();
    const baseUrl = (
      this.config.get<string>('AI_ASSISTANT_LLM_BASE_URL') ??
      'https://api.openai.com/v1'
    ).replace(/\/$/, '');
    const model =
      this.config.get<string>('AI_ASSISTANT_LLM_MODEL') ?? 'gpt-4o-mini';

    const system = `You are an AI assistant for Don Bosco College Tura Support Centre (BCL OneCampus ERP).
Given a support chat transcript, return ONLY JSON:
{
  "summary": "1-2 sentence summary",
  "suggestedReply": "professional reply an admin can send",
  "sentiment": "Frustrated|Happy|Urgent|Neutral|Confused",
  "suggestedCategory": "ADMISSIONS|FEES|SCHOLARSHIPS|EXAMINATION|RESULTS|CERTIFICATES|HOSTEL|LIBRARY|TRANSPORT|ERP_LOGIN|TECHNICAL|GENERAL",
  "suggestedPriority": "LOW|MEDIUM|HIGH|URGENT",
  "confidence": 0-100
}
Current category hint: ${category}
Be concise, factual, and college-support appropriate.`;

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content: transcript.slice(0, 6000) || '(empty chat)',
          },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty LLM response');
    const parsed = JSON.parse(content) as Partial<SupportAiAssistResult>;
    const sentimentRaw = String(parsed.sentiment ?? 'Neutral');
    const sentiment = (
      ['Frustrated', 'Happy', 'Urgent', 'Neutral', 'Confused'] as const
    ).includes(sentimentRaw as SupportAiAssistResult['sentiment'])
      ? (sentimentRaw as SupportAiAssistResult['sentiment'])
      : 'Neutral';
    const priorityRaw = String(
      parsed.suggestedPriority ?? 'MEDIUM',
    ).toUpperCase();
    const suggestedPriority = (
      ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const
    ).includes(priorityRaw as SupportAiAssistResult['suggestedPriority'])
      ? (priorityRaw as SupportAiAssistResult['suggestedPriority'])
      : 'MEDIUM';

    return {
      summary:
        String(parsed.summary ?? '').trim() ||
        'Conversation summary unavailable.',
      suggestedReply:
        String(parsed.suggestedReply ?? '').trim() ||
        'Thank you for contacting us. We will look into this shortly.',
      sentiment,
      suggestedCategory: String(
        parsed.suggestedCategory ?? category ?? 'GENERAL',
      )
        .toUpperCase()
        .trim(),
      suggestedPriority,
      confidence: Math.max(
        0,
        Math.min(100, Number(parsed.confidence ?? 70) || 70),
      ),
    };
  }
}

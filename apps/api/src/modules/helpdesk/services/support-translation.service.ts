import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SupportLang } from '../constants/support-centre.constants';
import { offlineTranslate } from '../constants/support-offline-dictionary';

export type TranslationResult = {
  langDetected: SupportLang;
  bodyTranslated: string | null;
  langTarget: string;
  status: 'ok' | 'same_language' | 'unavailable' | 'failed';
  note?: string;
  source?: 'llm' | 'offline' | 'none';
};

const LANG_LABELS: Record<string, string> = {
  en: 'English',
  garo: 'Garo',
  khasi: 'Khasi',
  hi: 'Hindi',
  ta: 'Tamil',
  bn: 'Bengali',
  as: 'Assamese',
  other: 'Other',
};

@Injectable()
export class SupportTranslationService {
  private readonly logger = new Logger(SupportTranslationService.name);
  private readonly cache = new Map<string, TranslationResult>();

  constructor(private readonly config: ConfigService) {}

  enabled() {
    return Boolean(this.config.get<string>('AI_ASSISTANT_LLM_API_KEY')?.trim());
  }

  langLabel(code: string) {
    return LANG_LABELS[code] ?? code;
  }

  async detectAndTranslate(input: {
    text: string;
    targetLang: string;
    translationEnabled?: boolean;
  }): Promise<TranslationResult> {
    const text = input.text.trim();
    const target = (input.targetLang || 'en').toLowerCase();
    if (!text) {
      return {
        langDetected: 'en',
        bodyTranslated: null,
        langTarget: target,
        status: 'same_language',
        source: 'none',
      };
    }

    const heuristic = this.heuristicDetect(text);
    if (input.translationEnabled === false) {
      return {
        langDetected: heuristic,
        bodyTranslated: null,
        langTarget: target,
        status: 'unavailable',
        note: 'Translation is disabled in Support Centre settings.',
        source: 'none',
      };
    }

    // Same-language short-circuit for plain English → English
    if (heuristic === 'en' && (target === 'en' || target === 'english')) {
      return {
        langDetected: 'en',
        bodyTranslated: null,
        langTarget: target,
        status: 'same_language',
        note: 'Original is already English. Translation not required.',
        source: 'none',
      };
    }

    const cacheKey = `${target}::${text}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    // Prefer offline dictionary first for known campus phrases (fast, free).
    const offline = this.tryOffline(text, target, heuristic);
    if (offline && offline.status === 'ok') {
      this.remember(cacheKey, offline);
      // If LLM is available, still try to improve — but return offline immediately
      // when no key so chat UX works without payment.
      if (!this.enabled()) return offline;
    }

    if (!this.enabled()) {
      if (offline) {
        this.remember(cacheKey, offline);
        return offline;
      }
      return {
        langDetected: heuristic,
        bodyTranslated: null,
        langTarget: target,
        status: 'unavailable',
        note: 'No AI key and no offline dictionary match. Try rephrasing, or add common phrases to the Support Centre dictionary.',
        source: 'none',
      };
    }

    try {
      const result = await this.callLlm(text, target, heuristic);
      this.remember(cacheKey, { ...result, source: 'llm' });
      return { ...result, source: 'llm' };
    } catch (err) {
      this.logger.warn(
        `Translation failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      if (offline) {
        this.remember(cacheKey, offline);
        return {
          ...offline,
          note: `${offline.note || 'Offline dictionary used.'} (AI call failed.)`,
        };
      }
      return {
        langDetected: heuristic,
        bodyTranslated: null,
        langTarget: target,
        status: 'failed',
        note: 'Translation failed. Click Translate to retry.',
        source: 'none',
      };
    }
  }

  private tryOffline(
    text: string,
    target: string,
    heuristic: SupportLang,
  ): TranslationResult | null {
    const hit = offlineTranslate(text, target);
    if (!hit) return null;
    return {
      langDetected: hit.langDetected || heuristic,
      bodyTranslated: hit.translated,
      langTarget: target,
      status: 'ok',
      note: hit.note,
      source: 'offline',
    };
  }

  private remember(key: string, value: TranslationResult) {
    if (this.cache.size > 500) this.cache.clear();
    this.cache.set(key, value);
  }

  private heuristicDetect(text: string): SupportLang {
    if (/[\u0B80-\u0BFF]/.test(text)) return 'ta';
    if (/[\u0900-\u097F]/.test(text)) return 'hi';
    if (/[\u0980-\u09FF]/.test(text)) return 'bn';
    if (
      /[∙·]/.test(text) ||
      /\b(na∙a|na·a|na-a|naa|man∙jaha|man·jaha|man-jaha|manjaha|dakaha|namgipa|mitelaniko|angna)\b/i.test(
        text,
      )
    ) {
      return 'garo';
    }
    if (/\b(khublei|sngewbha|ym\s+paw|ym\s+lah|jingban)\b/i.test(text)) {
      return 'khasi';
    }
    return 'en';
  }

  private async callLlm(
    text: string,
    targetLang: string,
    fallbackDetect: SupportLang,
  ): Promise<TranslationResult> {
    const apiKey = this.config.get<string>('AI_ASSISTANT_LLM_API_KEY')!.trim();
    const baseUrl = (
      this.config.get<string>('AI_ASSISTANT_LLM_BASE_URL') ??
      'https://api.openai.com/v1'
    ).replace(/\/$/, '');
    const model =
      this.config.get<string>('AI_ASSISTANT_LLM_MODEL') ?? 'gpt-4o-mini';

    const targetName = this.langLabel(targetLang);
    const system = `You are a professional multilingual translator for Don Bosco College Tura (Meghalaya, Northeast India).
You specially handle Garo and Khasi orthography (including ∙ / · markers) plus Hindi, Tamil, Bengali, Assamese, and English.

Tasks:
1) Detect source language: en | garo | khasi | hi | ta | bn | as | other
2) Translate into ${targetName} (code: ${targetLang}) clearly for college admin/student support staff.
3) Preserve proper nouns, roll numbers, fee amounts, scholarship/ERP terms.

Return ONLY JSON:
{"langDetected":"en|garo|khasi|hi|ta|bn|as|other","translated":"<full translation in ${targetName}>"}

Always provide a meaningful translation when the source is not already ${targetName}.`;

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.15,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content: `Target language: ${targetName} (${targetLang})\nMessage:\n${text}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty LLM response');
    const parsed = JSON.parse(content) as {
      langDetected?: string;
      translated?: string;
    };
    const langDetected =
      this.normalizeLang(parsed.langDetected) || fallbackDetect;
    const translated = String(parsed.translated ?? '').trim();
    if (!translated) {
      return {
        langDetected,
        bodyTranslated: null,
        langTarget: targetLang,
        status: 'failed',
        note: 'Empty translation from AI. Retry.',
        source: 'llm',
      };
    }
    if (langDetected === targetLang || translated === text) {
      return {
        langDetected,
        bodyTranslated: translated,
        langTarget: targetLang,
        status: langDetected === targetLang ? 'same_language' : 'ok',
        source: 'llm',
      };
    }
    return {
      langDetected,
      bodyTranslated: translated,
      langTarget: targetLang,
      status: 'ok',
      source: 'llm',
    };
  }

  private normalizeLang(raw?: string): SupportLang {
    const v = String(raw ?? 'other')
      .toLowerCase()
      .trim();
    if (v === 'english') return 'en';
    if (v === 'hindi') return 'hi';
    if (v === 'tamil') return 'ta';
    if (v === 'bengali') return 'bn';
    if (v === 'assamese') return 'as';
    if (
      v === 'en' ||
      v === 'garo' ||
      v === 'khasi' ||
      v === 'hi' ||
      v === 'ta' ||
      v === 'bn' ||
      v === 'as'
    ) {
      return v;
    }
    return 'other';
  }
}

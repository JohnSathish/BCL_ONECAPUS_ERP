import { Injectable, Logger } from '@nestjs/common';
import { FieldEncryptionService } from '../../common/crypto/field-encryption.service';
import { PrismaService } from '../../database/prisma.service';
import { MoodleSettingsService } from './moodle-settings.service';

type MoodleCallOptions = {
  tenantId: string;
  wsfunction: string;
  params?: Record<string, unknown>;
};

@Injectable()
export class MoodleApiService {
  private readonly logger = new Logger(MoodleApiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: MoodleSettingsService,
    private readonly crypto: FieldEncryptionService,
  ) {}

  async call<T = unknown>(options: MoodleCallOptions): Promise<T> {
    const config = await this.settings.getDecrypted(options.tenantId);
    if (!config.moodleUrl || !config.wsToken) {
      throw new Error('Moodle is not configured for this tenant');
    }

    const base = config.moodleUrl.replace(/\/+$/, '');
    const url = new URL(`${base}/webservice/rest/server.php`);
    url.searchParams.set('wstoken', config.wsToken);
    url.searchParams.set('wsfunction', options.wsfunction);
    url.searchParams.set('moodlewsrestformat', 'json');

    const body = new URLSearchParams();
    this.flattenParams(body, options.params ?? {});

    const started = Date.now();
    let httpStatus = 0;
    let success = true;
    let errorMessage: string | undefined;
    let payload: unknown;

    try {
      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      httpStatus = res.status;
      payload = await res.json();
      if (!res.ok) {
        success = false;
        errorMessage = `HTTP ${res.status}`;
      } else if (
        payload &&
        typeof payload === 'object' &&
        'exception' in (payload as Record<string, unknown>)
      ) {
        success = false;
        const moodle = payload as Record<string, unknown>;
        const message = String(moodle.message ?? 'Moodle exception');
        const debuginfo = moodle.debuginfo ? String(moodle.debuginfo) : '';
        const errorcode = moodle.errorcode ? String(moodle.errorcode) : '';
        errorMessage = [message, errorcode, debuginfo]
          .filter(Boolean)
          .join(' | ')
          .slice(0, 1000);
      }
      if (!success) {
        throw new Error(errorMessage ?? 'Moodle API error');
      }
      return payload as T;
    } catch (err) {
      success = false;
      errorMessage = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      const durationMs = Date.now() - started;
      const moodlePayload =
        payload && typeof payload === 'object'
          ? (payload as Record<string, unknown>)
          : null;
      await this.prisma.moodleApiLog
        .create({
          data: {
            tenantId: options.tenantId,
            wsFunction: options.wsfunction,
            httpStatus: httpStatus || null,
            success,
            durationMs,
            requestMeta: { paramKeys: Object.keys(options.params ?? {}) },
            responseMeta: success
              ? { type: typeof payload }
              : {
                  error: errorMessage?.slice(0, 500),
                  exception: moodlePayload?.exception ?? null,
                  errorcode: moodlePayload?.errorcode ?? null,
                  debuginfo:
                    typeof moodlePayload?.debuginfo === 'string'
                      ? moodlePayload.debuginfo.slice(0, 500)
                      : null,
                },
            errorMessage: errorMessage?.slice(0, 1000) ?? null,
          },
        })
        .catch((e) => this.logger.warn(`moodle api log failed: ${e}`));
    }
  }

  async testConnection(tenantId: string) {
    const site = await this.call<{ sitename?: string; release?: string }>({
      tenantId,
      wsfunction: 'core_webservice_get_site_info',
    });
    await this.settings.markConnection(tenantId, 'CONNECTED', null);
    return {
      ok: true,
      siteName: site.sitename ?? 'Moodle',
      release: site.release ?? null,
    };
  }

  private flattenParams(
    body: URLSearchParams,
    params: Record<string, unknown>,
    prefix = '',
  ) {
    for (const [key, value] of Object.entries(params)) {
      const path = prefix ? `${prefix}[${key}]` : key;
      if (value == null) continue;
      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (item && typeof item === 'object' && !Array.isArray(item)) {
            this.flattenParams(
              body,
              item as Record<string, unknown>,
              `${path}[${index}]`,
            );
          } else {
            body.append(`${path}[${index}]`, String(item));
          }
        });
      } else if (typeof value === 'object') {
        this.flattenParams(body, value as Record<string, unknown>, path);
      } else {
        body.append(path, String(value));
      }
    }
  }
}

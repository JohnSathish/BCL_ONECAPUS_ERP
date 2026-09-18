import { Logger } from '@nestjs/common';
import { isOneCampusCentralKey } from './school-sis-license-keys';

const log = new Logger('SchoolSisCentralLicense');

export type CentralActivateResult = {
  ok: true;
  licenseKey: string;
  expiryDate: string | null;
  graceDays: number;
  status: string;
  activationId: string;
  productCode: string | null;
};

export type CentralHeartbeatResult = {
  ok: boolean;
  status: string;
  expired: boolean;
  unreachable: boolean;
};

function centralBaseUrl() {
  const configured = process.env.BASECODE_CENTRAL_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  if (process.env.NODE_ENV === 'production') return '';
  return 'http://127.0.0.1:1610';
}

function licenseHeaders() {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const secret = process.env.BASECODE_LICENSE_API_SECRET?.trim();
  if (secret) headers['X-BCL-License-Secret'] = secret;
  else if (process.env.NODE_ENV === 'production') {
    log.error('BASECODE_LICENSE_API_SECRET is not set');
  }
  return headers;
}

export async function activateAgainstBaseCodeCentral(input: {
  licenseKey: string;
  installationId: string;
  institutionCode: string;
  hosts?: string[];
  appVersion?: string;
}): Promise<CentralActivateResult | null> {
  if (!isOneCampusCentralKey(input.licenseKey)) return null;
  const base = centralBaseUrl();
  if (!base) {
    log.error('BASECODE_CENTRAL_URL is required in production');
    return null;
  }
  if (
    process.env.NODE_ENV === 'production' &&
    !process.env.BASECODE_LICENSE_API_SECRET?.trim()
  ) {
    log.error('BASECODE_LICENSE_API_SECRET is required in production');
    return null;
  }
  try {
    const res = await fetch(`${base}/api/license/activate`, {
      method: 'POST',
      headers: licenseHeaders(),
      body: JSON.stringify({
        licenseKey: input.licenseKey.trim().toUpperCase(),
        productCode: 'ONC',
        installationId: input.installationId,
        domain: input.institutionCode.trim().toLowerCase(),
        hosts: input.hosts ?? [],
        appVersion: input.appVersion ?? 'school-sis',
        os: 'erp-server',
      }),
    });
    const data = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!res.ok) {
      log.warn(
        `BaseCode Central activate failed ${res.status}: ${String(data.error ?? res.statusText)}`,
      );
      return null;
    }
    return {
      ok: true,
      licenseKey: input.licenseKey.trim().toUpperCase(),
      expiryDate:
        typeof data.expiryDate === 'string'
          ? data.expiryDate
          : data.expiryDate
            ? new Date(data.expiryDate as string).toISOString()
            : null,
      graceDays: Number(data.graceDays ?? 7),
      status: String(data.status ?? 'ACTIVE'),
      activationId: String(data.activationId ?? ''),
      productCode:
        typeof data.productCode === 'string' ? data.productCode : 'ONC',
    };
  } catch (e) {
    log.warn(`BaseCode Central unreachable: ${String(e)}`);
    return null;
  }
}

export async function heartbeatBaseCodeCentral(input: {
  licenseKey: string;
  installationId: string;
}): Promise<CentralHeartbeatResult> {
  if (!isOneCampusCentralKey(input.licenseKey)) {
    return { ok: true, status: 'LOCAL', expired: false, unreachable: false };
  }
  const base = centralBaseUrl();
  if (!base) {
    return {
      ok: false,
      status: 'UNCONFIGURED',
      expired: false,
      unreachable: true,
    };
  }
  try {
    const res = await fetch(`${base}/api/license/heartbeat`, {
      method: 'POST',
      headers: licenseHeaders(),
      body: JSON.stringify({
        licenseKey: input.licenseKey.trim().toUpperCase(),
        installationId: input.installationId,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!res.ok) {
      return {
        ok: false,
        status: String(data.status ?? data.error ?? res.status),
        expired: Boolean(data.expired),
        unreachable: res.status >= 500,
      };
    }
    return {
      ok: Boolean(data.ok),
      status: String(data.status ?? 'ACTIVE'),
      expired: Boolean(data.expired),
      unreachable: false,
    };
  } catch (e) {
    log.warn(`BaseCode Central heartbeat unreachable: ${String(e)}`);
    return {
      ok: false,
      status: 'UNREACHABLE',
      expired: false,
      unreachable: true,
    };
  }
}

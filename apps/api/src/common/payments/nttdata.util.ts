import { createCipheriv, createDecipheriv, pbkdf2Sync } from 'crypto';

const FIXED_IV = Buffer.from([
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
]);

export type NttDataCredentials = {
  merchantId: string;
  password: string;
  encKey: string;
  decKey: string;
  mode?: 'TEST' | 'LIVE';
};

export type NttDataAuthResponse = {
  atomTokenId?: string | number;
  responseDetails?: {
    txnStatusCode?: string;
    txnMessage?: string;
    txnDescription?: string;
  };
};

function authUrl(mode?: 'TEST' | 'LIVE') {
  return mode === 'LIVE'
    ? 'https://payment1.atomtech.in/ots/aipay/auth'
    : 'https://paynetzuat.atomtech.in/ots/aipay/auth';
}

function trackingUrl(mode?: 'TEST' | 'LIVE') {
  return mode === 'LIVE'
    ? 'https://payment1.atomtech.in/ots/payment/status'
    : 'https://paynetzuat.atomtech.in/ots/payment/status';
}

function deriveKey(keyMaterial: string, digestAlgo: 'sha512' | 'sha1') {
  const salt = Buffer.from(keyMaterial, 'utf8');
  return pbkdf2Sync(
    Buffer.from(keyMaterial, 'utf8'),
    salt,
    65536,
    32,
    digestAlgo,
  );
}

export function nttDataEncrypt(
  data: string,
  encKey: string,
  digestAlgo: 'sha512' | 'sha1' = 'sha512',
) {
  const key = deriveKey(encKey, digestAlgo);
  const cipher = createCipheriv('aes-256-cbc', key, FIXED_IV);
  const encrypted = Buffer.concat([
    cipher.update(data, 'utf8'),
    cipher.final(),
  ]);
  return encrypted.toString('hex');
}

export function nttDataDecrypt(
  hexData: string,
  decKey: string,
  digestAlgo: 'sha512' | 'sha1' = 'sha512',
) {
  const key = deriveKey(decKey, digestAlgo);
  const decipher = createDecipheriv('aes-256-cbc', key, FIXED_IV);
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(hexData, 'hex')),
    decipher.final(),
  ]);
  const text = decrypted.toString('utf8');
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { raw: text } as Record<string, unknown>;
  }
}

export function isNttDataConfigured(
  creds?: Partial<NttDataCredentials> | null,
) {
  return Boolean(
    creds?.merchantId?.trim() &&
    creds?.password?.trim() &&
    creds?.encKey?.trim() &&
    creds?.decKey?.trim(),
  );
}

export function toNttDataCredentials(input: {
  merchantId?: string | null;
  keyId: string;
  keySecret: string;
  webhookSecret?: string | null;
  mode?: 'TEST' | 'LIVE';
}): NttDataCredentials | null {
  if (
    !input.merchantId?.trim() ||
    !input.keySecret?.trim() ||
    !input.keyId?.trim()
  ) {
    return null;
  }
  return {
    merchantId: input.merchantId.trim(),
    password: input.keySecret.trim(),
    encKey: input.keyId.trim(),
    decKey: input.webhookSecret?.trim() || input.keyId.trim(),
    mode: input.mode,
  };
}

function formatTxnDate(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export async function createNttDataAtomToken(
  creds: NttDataCredentials,
  input: {
    merchTxnId: string;
    amount: number;
    currency?: string;
    customerEmail?: string;
    customerMobile?: string;
    returnUrl?: string;
    udf?: Record<string, string>;
  },
): Promise<NttDataAuthResponse> {
  const payload = {
    payInstrument: {
      headDetails: {
        version: 'OTSv1.1',
        api: 'AUTH',
        platform: 'FLASH',
      },
      merchDetails: {
        merchId: creds.merchantId,
        password: creds.password,
        merchTxnId: input.merchTxnId.slice(0, 40),
        merchTxnDate: formatTxnDate(),
      },
      payDetails: {
        amount: Number(input.amount).toFixed(2),
        product: 'NSE',
        custAccNo: '213232323',
        txnCurrency: input.currency ?? 'INR',
      },
      custDetails: {
        custEmail: input.customerEmail ?? 'student@institution.edu',
        custMobile: input.customerMobile ?? '9999999999',
      },
      extras: {
        udf1: input.udf?.paymentId ?? '',
        udf2: input.udf?.studentId ?? '',
        udf3: input.returnUrl ?? '',
        udf4: '',
        udf5: '',
      },
    },
  };

  const encData = nttDataEncrypt(JSON.stringify(payload), creds.encKey);
  const body = `encData=${encodeURIComponent(encData)}&merchId=${encodeURIComponent(creds.merchantId)}`;
  const res = await fetch(authUrl(creds.mode), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      text?.slice(0, 240) || `NTT DATA auth failed (${res.status})`,
    );
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    const parts = text.split('&');
    const encPart = parts.find((p) => p.startsWith('encData='));
    if (!encPart) {
      throw new Error('Unexpected NTT DATA auth response.');
    }
    const encResp = decodeURIComponent(encPart.split('=').slice(1).join('='));
    parsed = nttDataDecrypt(encResp, creds.decKey);
  }

  if (parsed.txnMessage === 'FAILED') {
    throw new Error(String(parsed.txnDescription ?? 'NTT DATA auth failed.'));
  }

  if (parsed.responseDetails || parsed.atomTokenId) {
    return parsed as NttDataAuthResponse;
  }

  const encResp = String(
    (parsed as { encData?: string }).encData ??
      text
        .split('&')
        .find((p) => p.includes('encData='))
        ?.split('=')[1] ??
      '',
  );
  if (!encResp)
    throw new Error('NTT DATA auth response missing encrypted data.');
  const decrypted = nttDataDecrypt(decodeURIComponent(encResp), creds.decKey);
  return decrypted as NttDataAuthResponse;
}

export async function trackNttDataTransaction(
  creds: NttDataCredentials,
  input: { merchTxnId: string; amount: number; txnDate: string },
) {
  const plain = `merchantid=${creds.merchantId}&merchanttxnid=${input.merchTxnId}&amt=${input.amount.toFixed(2)}&tdate=${input.txnDate}`;
  const enc = nttDataEncrypt(plain, creds.encKey, 'sha1');
  const body = `login=${encodeURIComponent(creds.merchantId)}&encdata=${encodeURIComponent(enc)}`;
  const res = await fetch(trackingUrl(creds.mode), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      text?.slice(0, 240) || `NTT DATA status failed (${res.status})`,
    );
  }
  return nttDataDecrypt(text.trim(), creds.decKey, 'sha1');
}

export function verifyNttDataReturnPayload(
  creds: NttDataCredentials,
  encData: string,
) {
  const payload = nttDataDecrypt(encData, creds.decKey);
  const status = String(
    (payload as { payInstrument?: { payDetails?: { status?: string } } })
      ?.payInstrument?.payDetails?.status ??
      (payload as { status?: string }).status ??
      (payload as { responseDetails?: { txnStatusCode?: string } })
        .responseDetails?.txnStatusCode ??
      '',
  ).toUpperCase();
  const success =
    status === 'OTS0000' ||
    status === 'SUCCESS' ||
    status === '0300' ||
    status === 'OK';
  return { valid: success, payload };
}

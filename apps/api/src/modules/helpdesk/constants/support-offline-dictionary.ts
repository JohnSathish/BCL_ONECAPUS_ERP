/**
 * Offline phrase dictionary for Support Centre translation.
 * Used when AI_ASSISTANT_LLM_API_KEY is not configured.
 * Quality is limited to known campus-support phrases (Garo / Khasi → English/Tamil).
 */

export type OfflineDictHit = {
  translated: string;
  langDetected: 'garo' | 'khasi' | 'en';
  note: string;
};

/** Normalize Garo orthography variants for matching. */
export function normalizeSupportText(input: string): string {
  return (
    input
      .normalize('NFKC')
      .replace(/[∙·•‧]/g, '')
      .replace(/[\u2018\u2019']/g, '')
      // Remove hyphens so "Na-a" / "man-jaha" → "naa" / "manjaha"
      .replace(/[-–—_/]/g, '')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
  );
}

/** Exact / near-exact phrase → English */
const GARO_TO_EN: Array<[string, string]> = [
  // From live campus chat examples
  [
    'naa scholarship apply dakaha manjaha',
    'My scholarship application is not showing.',
  ],
  ['naa fee payment dakaha manjaha', 'My fee payment is not showing.'],
  ['naa fee dakaha manjaha', 'My fee is not showing.'],
  ['naa scholarship dakaha manjaha', 'My scholarship is not showing.'],
  ['naa result dakaha manjaha', 'My result is not showing.'],
  ['naa marks dakaha manjaha', 'My marks are not showing.'],
  ['naa attendance dakaha manjaha', 'My attendance is not showing.'],
  ['naa admit card dakaha manjaha', 'My admit card is not showing.'],
  ['naa receipt dakaha manjaha', 'My receipt is not showing.'],
  ['naa login dakaha manjaha', 'I cannot log in / login is not working.'],
  ['naa password dakaha manjaha', 'My password is not working.'],
  ['naa account dakaha manjaha', 'My account is not showing / not working.'],
  ['naa hostel dakaha manjaha', 'My hostel details are not showing.'],
  ['naa transport dakaha manjaha', 'My transport details are not showing.'],
  ['naa certificate dakaha manjaha', 'My certificate is not showing.'],
  ['naa bonafide dakaha manjaha', 'My bonafide certificate is not showing.'],
  ['naa id card dakaha manjaha', 'My ID card is not showing.'],
  ['naa timetable dakaha manjaha', 'My timetable is not showing.'],
  ['naa exam form dakaha manjaha', 'My exam form is not showing.'],
  ['naa registration dakaha manjaha', 'My registration is not showing.'],

  // Common support intents
  [
    'scholarship apply dakaha manjaha',
    'Scholarship application is not showing.',
  ],
  ['fee payment dakaha manjaha', 'Fee payment is not showing.'],
  ['fee receipt dakaha manjaha', 'Fee receipt is not showing.'],
  ['payment failed', 'Payment failed.'],
  ['payment success manjaha', 'Payment success is not showing.'],
  ['namgipa', 'Hello / Greetings.'],
  ['pringnam', 'Good morning.'],
  ['attamnam', 'Good evening.'],
  ['mitelaniko', 'Thank you.'],
  ['ongja', 'No / It is not so.'],
  ['onga', 'Yes / It is so.'],
  ['angna help nangnika', 'I need help.'],
  ['angna help nanga', 'I need help.'],
  ['office ona nanga', 'I need to come to the office.'],
  ['office ona manjaha', 'I cannot come to the office.'],
  ['password forget', 'I forgot my password.'],
  ['password reset nanga', 'I need a password reset.'],
  ['account locked', 'My account is locked.'],
  ['roll number', 'Roll number'],
  ['naa roll number', 'My roll number'],
  ['fees pending', 'Fees are pending.'],
  ['fees clear manjaha', 'Fees are not cleared / still due.'],
  ['scholarship status', 'Scholarship status'],
  ['naa scholarship status', 'My scholarship status'],
  ['exam date', 'Exam date'],
  ['result publish manjaha', 'Result is not published / not showing.'],
  ['marksheet dakaha manjaha', 'Marksheet is not showing.'],
  ['library fine', 'Library fine'],
  ['hostel fee', 'Hostel fee'],
  ['bus fee', 'Bus / transport fee'],
  ['admission fee', 'Admission fee'],
  ['semester fee', 'Semester fee'],
  ['naa name change nanga', 'I need a name change.'],
  ['document upload manjaha', 'Document upload is not working / not showing.'],
  ['photo upload manjaha', 'Photo upload is not working.'],
  ['otp manjaha', 'OTP is not coming / not working.'],
  ['email manjaha', 'Email is not coming / not working.'],
  ['sms manjaha', 'SMS is not coming.'],
  ['app open manjaha', 'The app is not opening.'],
  ['website open manjaha', 'The website is not opening.'],
  ['slow ase', 'It is very slow.'],
  ['error ase', 'There is an error.'],
  ['please help', 'Please help.'],
  ['sir help', 'Sir, please help.'],
  ['madam help', 'Madam, please help.'],
];

/** Exact / near-exact phrase → Tamil (for Tamil-speaking staff) */
const GARO_TO_TA: Array<[string, string]> = [
  [
    'naa scholarship apply dakaha manjaha',
    'என் உதவித்தொகை விண்ணப்பம் தெரியவில்லை.',
  ],
  ['naa fee payment dakaha manjaha', 'என் கட்டணம் செலுத்துதல் தெரியவில்லை.'],
  ['naa fee dakaha manjaha', 'என் கட்டணம் தெரியவில்லை.'],
  ['naa scholarship dakaha manjaha', 'என் உதவித்தொகை தெரியவில்லை.'],
  ['naa result dakaha manjaha', 'என் முடிவுகள் தெரியவில்லை.'],
  ['naa marks dakaha manjaha', 'என் மதிப்பெண்கள் தெரியவில்லை.'],
  ['naa attendance dakaha manjaha', 'என் வருகைப்பதிவு தெரியவில்லை.'],
  ['naa login dakaha manjaha', 'என்னால் உள்நுழைய முடியவில்லை.'],
  ['naa password dakaha manjaha', 'என் கடவுச்சொல் வேலை செய்யவில்லை.'],
  ['angna help nangnika', 'எனக்கு உதவி வேண்டும்.'],
  ['angna help nanga', 'எனக்கு உதவி வேண்டும்.'],
  ['mitelaniko', 'நன்றி.'],
  ['namgipa', 'வணக்கம்.'],
  ['password reset nanga', 'கடவுச்சொல் மீட்டமைப்பு வேண்டும்.'],
  ['account locked', 'என் கணக்கு பூட்டப்பட்டுள்ளது.'],
  ['fees pending', 'கட்டணம் நிலுவையில் உள்ளது.'],
];

const KHASI_TO_EN: Array<[string, string]> = [
  ['nga tip ym', 'I do not know.'],
  ['sngewbha', 'Thank you.'],
  ['khublei', 'Hello / Blessings.'],
  ['nga pyrshang ban', 'I am trying to'],
  ['ym lah ban', 'Cannot / Not able to'],
  ['nga don jingban', 'I have a problem.'],
  ['scholarship ym paw', 'Scholarship is not showing.'],
  ['fee ym paw', 'Fee is not showing.'],
  ['result ym paw', 'Result is not showing.'],
  ['login ym lah', 'Cannot log in.'],
  ['password klet', 'Forgot password.'],
  ['help nga', 'I need help.'],
];

const TOPIC_EN: Array<[RegExp, string]> = [
  [/\bscholarship\s*apply\b/i, 'scholarship application'],
  [/\bscholarship\b/i, 'scholarship'],
  [/\bfee\s*payment\b/i, 'fee payment'],
  [/\bfee\s*receipt\b/i, 'fee receipt'],
  [/\bfees?\b/i, 'fee'],
  [/\bresult\b/i, 'result'],
  [/\bmarks?\b/i, 'marks'],
  [/\battendance\b/i, 'attendance'],
  [/\badmit\s*card\b/i, 'admit card'],
  [/\breceipt\b/i, 'receipt'],
  [/\blogin\b/i, 'login'],
  [/\bpassword\b/i, 'password'],
  [/\baccount\b/i, 'account'],
  [/\bhostel\b/i, 'hostel'],
  [/\btransport\b|\bbus\b/i, 'transport'],
  [/\bbonafide\b/i, 'bonafide certificate'],
  [/\bcertificate\b/i, 'certificate'],
  [/\bid\s*card\b/i, 'ID card'],
  [/\btimetable\b/i, 'timetable'],
  [/\bexam\s*form\b/i, 'exam form'],
  [/\bregistration\b/i, 'registration'],
  [/\bmarksheet\b/i, 'marksheet'],
  [/\botp\b/i, 'OTP'],
];

const TOPIC_TA: Array<[RegExp, string]> = [
  [/\bscholarship\s*apply\b/i, 'உதவித்தொகை விண்ணப்பம்'],
  [/\bscholarship\b/i, 'உதவித்தொகை'],
  [/\bfee\s*payment\b/i, 'கட்டணம் செலுத்துதல்'],
  [/\bfees?\b/i, 'கட்டணம்'],
  [/\bresult\b/i, 'முடிவு'],
  [/\bmarks?\b/i, 'மதிப்பெண்கள்'],
  [/\battendance\b/i, 'வருகைப்பதிவு'],
  [/\blogin\b/i, 'உள்நுழைவு'],
  [/\bpassword\b/i, 'கடவுச்சொல்'],
  [/\baccount\b/i, 'கணக்கு'],
  [/\breceipt\b/i, 'ரசீது'],
  [/\bcertificate\b/i, 'சான்றிதழ்'],
];

function lookupExact(
  normalized: string,
  table: Array<[string, string]>,
): string | null {
  for (const [src, dst] of table) {
    if (normalized === src) return dst;
    if (normalized.includes(src) && src.length >= 12) return dst;
  }
  // fuzzy: ignore trailing punctuation already stripped
  for (const [src, dst] of table) {
    if (src.includes(normalized) && normalized.length >= 10) return dst;
  }
  return null;
}

function extractTopic(
  text: string,
  table: Array<[RegExp, string]>,
): string | null {
  for (const [re, label] of table) {
    if (re.test(text)) return label;
  }
  return null;
}

/**
 * Try offline dictionary / pattern translation.
 * Returns null if no confident match.
 */
export function offlineTranslate(
  text: string,
  targetLang: string,
): OfflineDictHit | null {
  const target = (targetLang || 'en').toLowerCase();
  const normalized = normalizeSupportText(text);
  if (!normalized) return null;

  const isGaro =
    /[∙·]/.test(text) ||
    /\b(naa|manjaha|dakaha|namgipa|mitelaniko|angna|nanga|nangnika)\b/i.test(
      normalized,
    );

  const isKhasi =
    /\b(khublei|sngewbha|nga|ym\s+paw|ym\s+lah|jingban|pyrshang)\b/i.test(
      normalized,
    );

  // Exact phrase tables
  if (target === 'ta' || target === 'tamil') {
    const hit = lookupExact(normalized, GARO_TO_TA);
    if (hit) {
      return {
        translated: hit,
        langDetected: 'garo',
        note: 'Offline dictionary (Garo → Tamil). Limited phrases — add AI key for full translation.',
      };
    }
  }

  if (
    target === 'en' ||
    target === 'english' ||
    target === 'ta' ||
    target === 'tamil'
  ) {
    const enHit =
      lookupExact(normalized, GARO_TO_EN) ||
      (isKhasi ? lookupExact(normalized, KHASI_TO_EN) : null);
    if (enHit) {
      if (target === 'ta' || target === 'tamil') {
        // Prefer Tamil table; else return English with note
        return {
          translated: enHit,
          langDetected: isKhasi ? 'khasi' : 'garo',
          note: 'Offline dictionary (English gloss). Tamil phrase not in dictionary for this message.',
        };
      }
      return {
        translated: enHit,
        langDetected: isKhasi ? 'khasi' : 'garo',
        note: 'Offline dictionary translation (no AI key). Coverage is limited to common support phrases.',
      };
    }
  }

  // Pattern: "Na∙a <topic> dakaha man∙jaha" → "My <topic> is not showing."
  const notShowing =
    /\b(?:naa|nga)\b(.+?)\b(?:dakaha\s+)?manjaha\b/i.exec(normalized) ||
    /\b(.+?)\b(?:dakaha\s+)?manjaha\b/i.exec(normalized);

  if (notShowing && (isGaro || /manjaha|dakaha/.test(normalized))) {
    const rawTopic = (notShowing[1] || '').trim();
    const topicTable =
      target === 'ta' || target === 'tamil' ? TOPIC_TA : TOPIC_EN;
    const topic =
      extractTopic(rawTopic || text, topicTable) ||
      extractTopic(text, topicTable) ||
      (rawTopic
        ? rawTopic.replace(/\b(apply|status|details?)\b/gi, '').trim() ||
          'details'
        : 'details');

    if (target === 'ta' || target === 'tamil') {
      return {
        translated: `என் ${topic} தெரியவில்லை.`,
        langDetected: 'garo',
        note: 'Offline pattern translation (Garo → Tamil). Approximate — verify with student if unsure.',
      };
    }
    return {
      translated: `My ${topic} is not showing.`,
      langDetected: 'garo',
      note: 'Offline pattern translation (Garo → English). Approximate — verify with student if unsure.',
    };
  }

  // Pattern: need help
  if (/\b(help|nanga|nangnika)\b/i.test(normalized) && isGaro) {
    if (target === 'ta' || target === 'tamil') {
      return {
        translated: 'எனக்கு உதவி வேண்டும்.',
        langDetected: 'garo',
        note: 'Offline dictionary (Garo → Tamil).',
      };
    }
    return {
      translated: 'I need help.',
      langDetected: 'garo',
      note: 'Offline dictionary (Garo → English).',
    };
  }

  // Khasi "ym paw" = not showing
  if (/\bym\s+paw\b/i.test(normalized)) {
    const topic = extractTopic(text, TOPIC_EN) || 'it';
    return {
      translated: `${topic[0].toUpperCase()}${topic.slice(1)} is not showing.`,
      langDetected: 'khasi',
      note: 'Offline pattern translation (Khasi → English).',
    };
  }

  return null;
}

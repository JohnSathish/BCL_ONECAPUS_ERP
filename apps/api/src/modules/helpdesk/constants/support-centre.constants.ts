export const SUPPORT_CATEGORIES = [
  'ADMISSIONS',
  'FEES',
  'SCHOLARSHIPS',
  'EXAMINATION',
  'RESULTS',
  'CERTIFICATES',
  'HOSTEL',
  'LIBRARY',
  'TRANSPORT',
  'ERP_LOGIN',
  'TECHNICAL',
  'GENERAL',
] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export const SUPPORT_TICKET_STATUSES = [
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'WAITING_STUDENT',
  'RESOLVED',
  'CLOSED',
] as const;

export const SUPPORT_TICKET_FLOW: Record<string, string[]> = {
  OPEN: ['ASSIGNED', 'IN_PROGRESS', 'CLOSED'],
  ASSIGNED: ['IN_PROGRESS', 'WAITING_STUDENT', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['WAITING_STUDENT', 'RESOLVED', 'CLOSED', 'ASSIGNED'],
  WAITING_STUDENT: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: [],
};

export const SUPPORT_CHAT_STATUSES = [
  'OPEN',
  'ASSIGNED',
  'WAITING',
  'CLOSED',
] as const;

export const SUPPORT_LANGS = [
  'en',
  'garo',
  'khasi',
  'hi',
  'ta',
  'bn',
  'as',
  'other',
] as const;

export type SupportLang = (typeof SUPPORT_LANGS)[number];

export const DEFAULT_SUPPORT_DEPARTMENTS: Array<{
  code: string;
  name: string;
  categories: SupportCategory[];
}> = [
  { code: 'ADMISSIONS', name: 'Admission Office', categories: ['ADMISSIONS'] },
  {
    code: 'ACCOUNTS',
    name: 'Accounts Office',
    categories: ['FEES', 'SCHOLARSHIPS'],
  },
  {
    code: 'EXAM',
    name: 'Examination Cell',
    categories: ['EXAMINATION', 'RESULTS', 'CERTIFICATES'],
  },
  { code: 'HOSTEL', name: 'Hostel Warden', categories: ['HOSTEL'] },
  { code: 'LIBRARY', name: 'Library', categories: ['LIBRARY'] },
  { code: 'TRANSPORT', name: 'Transport', categories: ['TRANSPORT'] },
  {
    code: 'IT',
    name: 'IT / ERP Support',
    categories: ['ERP_LOGIN', 'TECHNICAL'],
  },
  { code: 'GENERAL', name: 'General Helpdesk', categories: ['GENERAL'] },
];

export const DEFAULT_FAQ_SEED: Array<{
  categoryCode: string;
  categoryName: string;
  articles: Array<{ question: string; answer: string; keywords: string[] }>;
}> = [
  {
    categoryCode: 'ADMISSIONS',
    categoryName: 'Admissions',
    articles: [
      {
        question: 'How do I apply for admission?',
        answer:
          'Open Admissions on the college website or student portal, complete the application form, upload documents, and pay the application fee if required.',
        keywords: ['apply', 'admission', 'form'],
      },
    ],
  },
  {
    categoryCode: 'FEES',
    categoryName: 'Fees',
    articles: [
      {
        question: 'How do I pay fees online?',
        answer:
          'Go to Fees → Pay Online in the student portal, select pending dues, and complete payment through the payment gateway. A receipt will appear after success.',
        keywords: ['fees', 'pay', 'online', 'receipt'],
      },
    ],
  },
  {
    categoryCode: 'SCHOLARSHIPS',
    categoryName: 'Scholarships',
    articles: [
      {
        question: 'What documents are required for scholarships?',
        answer:
          'Typically income certificate, caste/community certificate (if applicable), bank passbook, Aadhaar, and previous mark sheets. Check the scholarship notice for the exact list.',
        keywords: ['scholarship', 'documents'],
      },
    ],
  },
  {
    categoryCode: 'EXAMINATION',
    categoryName: 'Examinations',
    articles: [
      {
        question: 'Where can I download my hall ticket?',
        answer:
          'Open Examinations → Admit Card / Hall Ticket in the student portal after registration and fee clearance are complete.',
        keywords: ['hall ticket', 'admit card', 'exam'],
      },
    ],
  },
];

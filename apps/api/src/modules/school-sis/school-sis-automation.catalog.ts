export const AUTO_OPERATORS = [
  'eq',
  'neq',
  'gt',
  'lt',
  'gte',
  'lte',
  'contains',
  'not_contains',
  'starts_with',
  'ends_with',
  'is_empty',
  'not_empty',
  'in',
  'not_in',
] as const;

export const AUTO_CHANNELS = [
  'SMS',
  'WHATSAPP',
  'EMAIL',
  'PUSH',
  'IN_APP',
] as const;

export const AUTO_VARIABLES = [
  'student_name',
  'admission_number',
  'roll_number',
  'class_name',
  'section',
  'parent_name',
  'father_name',
  'mother_name',
  'mobile_number',
  'fee_amount',
  'paid_amount',
  'balance_amount',
  'due_date',
  'receipt_number',
  'exam_name',
  'exam_date',
  'result',
  'grade',
  'attendance_percentage',
  'attendance_date',
  'school_name',
  'school_phone',
  'school_address',
  'academic_year',
] as const;

export type AutoTrigger = {
  event: string;
  label: string;
  category: string;
  type: 'EVENT' | 'SCHEDULE' | 'RELATIVE' | 'RECURRING';
};

export const AUTO_TRIGGERS: AutoTrigger[] = [
  {
    event: 'student.created',
    label: 'Student created',
    category: 'Student',
    type: 'EVENT',
  },
  {
    event: 'student.updated',
    label: 'Student updated',
    category: 'Student',
    type: 'EVENT',
  },
  {
    event: 'student.admitted',
    label: 'Student admitted',
    category: 'Student',
    type: 'EVENT',
  },
  {
    event: 'student.promoted',
    label: 'Student promoted',
    category: 'Student',
    type: 'EVENT',
  },
  {
    event: 'student.transferred',
    label: 'Student transferred',
    category: 'Student',
    type: 'EVENT',
  },
  {
    event: 'student.withdrawn',
    label: 'Student withdrawn',
    category: 'Student',
    type: 'EVENT',
  },
  {
    event: 'student.birthday',
    label: 'Student birthday',
    category: 'Student',
    type: 'RECURRING',
  },
  {
    event: 'student.status_changed',
    label: 'Student status changed',
    category: 'Student',
    type: 'EVENT',
  },
  {
    event: 'attendance.absent',
    label: 'Student marked absent',
    category: 'Attendance',
    type: 'EVENT',
  },
  {
    event: 'attendance.present',
    label: 'Student marked present',
    category: 'Attendance',
    type: 'EVENT',
  },
  {
    event: 'attendance.repeated_absence',
    label: 'Repeated absence',
    category: 'Attendance',
    type: 'EVENT',
  },
  {
    event: 'attendance.below_percentage',
    label: 'Attendance below percentage',
    category: 'Attendance',
    type: 'EVENT',
  },
  {
    event: 'attendance.late',
    label: 'Late arrival',
    category: 'Attendance',
    type: 'EVENT',
  },
  {
    event: 'attendance.early_departure',
    label: 'Early departure',
    category: 'Attendance',
    type: 'EVENT',
  },
  {
    event: 'fee.generated',
    label: 'Fee generated',
    category: 'Fees',
    type: 'EVENT',
  },
  {
    event: 'fee.due_soon',
    label: 'Fee due soon',
    category: 'Fees',
    type: 'RELATIVE',
  },
  {
    event: 'fee.due_today',
    label: 'Fee due today',
    category: 'Fees',
    type: 'RELATIVE',
  },
  {
    event: 'fee.overdue',
    label: 'Fee overdue',
    category: 'Fees',
    type: 'RELATIVE',
  },
  { event: 'fee.paid', label: 'Fee paid', category: 'Fees', type: 'EVENT' },
  {
    event: 'fee.partial',
    label: 'Partial payment',
    category: 'Fees',
    type: 'EVENT',
  },
  {
    event: 'payment.failed',
    label: 'Payment failed',
    category: 'Fees',
    type: 'EVENT',
  },
  {
    event: 'payment.success',
    label: 'Payment successful',
    category: 'Fees',
    type: 'EVENT',
  },
  {
    event: 'fee.receipt_generated',
    label: 'Receipt generated',
    category: 'Fees',
    type: 'EVENT',
  },
  {
    event: 'fee.threshold',
    label: 'Outstanding crosses threshold',
    category: 'Fees',
    type: 'EVENT',
  },
  {
    event: 'exam.created',
    label: 'Exam created',
    category: 'Examination',
    type: 'EVENT',
  },
  {
    event: 'exam.scheduled',
    label: 'Exam scheduled',
    category: 'Examination',
    type: 'EVENT',
  },
  {
    event: 'exam.rescheduled',
    label: 'Exam rescheduled',
    category: 'Examination',
    type: 'EVENT',
  },
  {
    event: 'exam.cancelled',
    label: 'Exam cancelled',
    category: 'Examination',
    type: 'EVENT',
  },
  {
    event: 'exam.marks_entered',
    label: 'Marks entered',
    category: 'Examination',
    type: 'EVENT',
  },
  {
    event: 'exam.marks_updated',
    label: 'Marks updated',
    category: 'Examination',
    type: 'EVENT',
  },
  {
    event: 'exam.result.published',
    label: 'Result published',
    category: 'Examination',
    type: 'EVENT',
  },
  {
    event: 'exam.report_card.published',
    label: 'Report card published',
    category: 'Examination',
    type: 'EVENT',
  },
  {
    event: 'exam.student_fails',
    label: 'Student fails',
    category: 'Examination',
    type: 'EVENT',
  },
  {
    event: 'exam.student_achieves_grade',
    label: 'Student achieves grade',
    category: 'Examination',
    type: 'EVENT',
  },
  {
    event: 'admission.submitted',
    label: 'Application submitted',
    category: 'Admission',
    type: 'EVENT',
  },
  {
    event: 'admission.verified',
    label: 'Application verified',
    category: 'Admission',
    type: 'EVENT',
  },
  {
    event: 'admission.rejected',
    label: 'Application rejected',
    category: 'Admission',
    type: 'EVENT',
  },
  {
    event: 'admission.approved',
    label: 'Application approved',
    category: 'Admission',
    type: 'EVENT',
  },
  {
    event: 'admission.payment_pending',
    label: 'Admission payment pending',
    category: 'Admission',
    type: 'EVENT',
  },
  {
    event: 'admission.payment_completed',
    label: 'Admission payment completed',
    category: 'Admission',
    type: 'EVENT',
  },
  {
    event: 'admission.document_missing',
    label: 'Document missing',
    category: 'Admission',
    type: 'EVENT',
  },
  {
    event: 'admission.confirmed',
    label: 'Admission confirmed',
    category: 'Admission',
    type: 'EVENT',
  },
  {
    event: 'transport.allocated',
    label: 'Student allocated',
    category: 'Transport',
    type: 'EVENT',
  },
  {
    event: 'transport.bus_started',
    label: 'Bus started',
    category: 'Transport',
    type: 'EVENT',
  },
  {
    event: 'transport.bus_delayed',
    label: 'Bus delayed',
    category: 'Transport',
    type: 'EVENT',
  },
  {
    event: 'transport.stop_reached',
    label: 'Bus reached stop',
    category: 'Transport',
    type: 'EVENT',
  },
  {
    event: 'transport.boarded',
    label: 'Student boarded',
    category: 'Transport',
    type: 'EVENT',
  },
  {
    event: 'transport.dropped',
    label: 'Student dropped',
    category: 'Transport',
    type: 'EVENT',
  },
  {
    event: 'transport.incident',
    label: 'Transport incident',
    category: 'Transport',
    type: 'EVENT',
  },
  {
    event: 'transport.route_changed',
    label: 'Route changed',
    category: 'Transport',
    type: 'EVENT',
  },
  {
    event: 'library.issued',
    label: 'Book issued',
    category: 'Library',
    type: 'EVENT',
  },
  {
    event: 'library.due',
    label: 'Book due',
    category: 'Library',
    type: 'RELATIVE',
  },
  {
    event: 'library.overdue',
    label: 'Book overdue',
    category: 'Library',
    type: 'RELATIVE',
  },
  {
    event: 'library.fine',
    label: 'Fine generated',
    category: 'Library',
    type: 'EVENT',
  },
  {
    event: 'library.returned',
    label: 'Book returned',
    category: 'Library',
    type: 'EVENT',
  },
  {
    event: 'notice.published',
    label: 'Notice published',
    category: 'Communication',
    type: 'EVENT',
  },
  {
    event: 'circular.published',
    label: 'Circular published',
    category: 'Communication',
    type: 'EVENT',
  },
  {
    event: 'announcement.created',
    label: 'Announcement created',
    category: 'Communication',
    type: 'EVENT',
  },
  {
    event: 'calendar.event.created',
    label: 'Event created',
    category: 'Calendar',
    type: 'EVENT',
  },
  {
    event: 'calendar.event.updated',
    label: 'Event updated',
    category: 'Calendar',
    type: 'EVENT',
  },
  {
    event: 'calendar.event.tomorrow',
    label: 'Event tomorrow',
    category: 'Calendar',
    type: 'RELATIVE',
  },
  {
    event: 'calendar.holiday.tomorrow',
    label: 'Holiday tomorrow',
    category: 'Calendar',
    type: 'RELATIVE',
  },
  {
    event: 'calendar.holiday.published',
    label: 'Holiday published',
    category: 'Calendar',
    type: 'EVENT',
  },
  {
    event: 'calendar.reopens.tomorrow',
    label: 'School reopens tomorrow',
    category: 'Calendar',
    type: 'RELATIVE',
  },
  {
    event: 'staff.leave.applied',
    label: 'Staff leave applied',
    category: 'Staff',
    type: 'EVENT',
  },
  {
    event: 'staff.leave.approved',
    label: 'Leave approved',
    category: 'Staff',
    type: 'EVENT',
  },
  {
    event: 'staff.leave.rejected',
    label: 'Leave rejected',
    category: 'Staff',
    type: 'EVENT',
  },
  {
    event: 'staff.attendance.missing',
    label: 'Staff attendance missing',
    category: 'Staff',
    type: 'EVENT',
  },
  {
    event: 'staff.late',
    label: 'Staff late arrival',
    category: 'Staff',
    type: 'EVENT',
  },
  {
    event: 'schedule.daily',
    label: 'Daily schedule',
    category: 'Schedule',
    type: 'SCHEDULE',
  },
];

export const AUTO_ACTIONS = [
  { type: 'SEND_SMS', label: 'Send SMS', channel: 'SMS' },
  { type: 'SEND_WHATSAPP', label: 'Send WhatsApp', channel: 'WHATSAPP' },
  { type: 'SEND_EMAIL', label: 'Send email', channel: 'EMAIL' },
  { type: 'SEND_PUSH', label: 'Send push notification', channel: 'PUSH' },
  {
    type: 'SEND_IN_APP',
    label: 'Create in-app notification',
    channel: 'IN_APP',
  },
  { type: 'NOTIFY_STAFF', label: 'Notify staff', channel: 'PUSH' },
  { type: 'NOTIFY_PARENT', label: 'Notify parent', channel: 'PUSH' },
  { type: 'NOTIFY_STUDENT', label: 'Notify student', channel: 'PUSH' },
  { type: 'CREATE_TASK', label: 'Create task' },
  { type: 'CREATE_REMINDER', label: 'Create reminder' },
  { type: 'ADD_TAG', label: 'Add tag' },
  { type: 'REMOVE_TAG', label: 'Remove tag' },
  { type: 'GENERATE_PDF', label: 'Generate PDF' },
  { type: 'CALL_WEBHOOK', label: 'Call webhook' },
  { type: 'CALL_INTERNAL_API', label: 'Call internal API' },
  { type: 'APPROVAL', label: 'Require approval' },
  { type: 'TRIGGER_WORKFLOW', label: 'Trigger another workflow' },
] as const;

export const AUTO_RECIPIENTS = [
  'STUDENT',
  'PARENT',
  'GUARDIAN',
  'FATHER',
  'MOTHER',
  'CLASS_TEACHER',
  'PRINCIPAL',
  'ACCOUNTANT',
  'ADMINISTRATOR',
  'TRANSPORT_MANAGER',
  'LIBRARIAN',
  'ROLE',
  'CLASS',
  'SECTION',
] as const;

export type GraphNode = {
  id: string;
  type:
    | 'TRIGGER'
    | 'CONDITION'
    | 'DELAY'
    | 'ACTION'
    | 'BRANCH'
    | 'WAIT'
    | 'APPROVAL'
    | 'WEBHOOK';
  data: Record<string, unknown>;
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  handle?: 'yes' | 'no';
};

export type AutoGraph = { nodes: GraphNode[]; edges: GraphEdge[] };

export type ConditionLeaf = {
  field: string;
  operator: string;
  value?: string | number | string[];
};

export type ConditionGroup = {
  op: 'AND' | 'OR';
  items: Array<ConditionLeaf | ConditionGroup>;
};

export const DEFAULT_AUTO_TEMPLATES = [
  {
    name: 'Absence alert',
    category: 'ATTENDANCE',
    channel: 'WHATSAPP',
    body: 'Dear {{parent_name}}, {{student_name}} was marked absent on {{attendance_date}} ({{class_name}} {{section}}). — {{school_name}}',
  },
  {
    name: 'Fee reminder',
    category: 'FEE',
    channel: 'WHATSAPP',
    body: 'Dear {{parent_name}}, fee of {{fee_amount}} for {{student_name}} is due on {{due_date}}. Balance: {{balance_amount}}. — {{school_name}}',
  },
  {
    name: 'Payment confirmation',
    category: 'FEE',
    channel: 'PUSH',
    subject: 'Payment received',
    body: 'Payment of {{paid_amount}} received for {{student_name}}. Receipt {{receipt_number}}.',
  },
  {
    name: 'Result published',
    category: 'EXAMINATION',
    channel: 'PUSH',
    subject: 'Examination result',
    body: 'Your child’s examination result is now available. Tap to view.',
  },
];

export const WORKFLOW_PRESETS: Array<{
  id: string;
  name: string;
  description: string;
  module: string;
  triggerType: string;
  triggerEvent: string;
  graph: AutoGraph;
  scheduleJson?: Record<string, unknown>;
}> = [
  {
    id: 'absence-alert',
    name: 'Absence alert',
    description:
      'Notify parent by WhatsApp and push when a student is marked absent.',
    module: 'ATTENDANCE',
    triggerType: 'EVENT',
    triggerEvent: 'attendance.absent',
    graph: {
      nodes: [
        { id: 't1', type: 'TRIGGER', data: { event: 'attendance.absent' } },
        {
          id: 'c1',
          type: 'CONDITION',
          data: {
            group: {
              op: 'AND',
              items: [{ field: 'mobile_number', operator: 'not_empty' }],
            },
          },
        },
        {
          id: 'a1',
          type: 'ACTION',
          data: {
            type: 'SEND_WHATSAPP',
            recipient: 'PARENT',
            body: 'Dear {{parent_name}}, {{student_name}} was marked absent on {{attendance_date}}.',
          },
        },
        {
          id: 'a2',
          type: 'ACTION',
          data: {
            type: 'SEND_PUSH',
            recipient: 'PARENT',
            title: 'Attendance update',
            body: '{{student_name}} was marked absent today.',
          },
        },
        {
          id: 'a3',
          type: 'ACTION',
          data: {
            type: 'SEND_SMS',
            recipient: 'PARENT',
            fallback: true,
            body: '{{student_name}} was marked absent today.',
          },
        },
      ],
      edges: [
        { id: 'e1', source: 't1', target: 'c1' },
        { id: 'e2', source: 'c1', target: 'a1', handle: 'yes' },
        { id: 'e3', source: 'a1', target: 'a2' },
        { id: 'e4', source: 'a2', target: 'a3' },
      ],
    },
  },
  {
    id: 'fee-reminder',
    name: 'Fee reminder — 3 days before',
    description: 'Remind parents when unpaid fees are due in 3 days.',
    module: 'FEE',
    triggerType: 'RELATIVE',
    triggerEvent: 'fee.due_soon',
    scheduleJson: { offsetDays: -3, time: '08:00' },
    graph: {
      nodes: [
        {
          id: 't1',
          type: 'TRIGGER',
          data: { event: 'fee.due_soon', offsetDays: -3 },
        },
        {
          id: 'c1',
          type: 'CONDITION',
          data: {
            group: {
              op: 'AND',
              items: [
                { field: 'fee_status', operator: 'eq', value: 'UNPAID' },
                { field: 'balance_amount', operator: 'gt', value: 0 },
                { field: 'student_status', operator: 'eq', value: 'ACTIVE' },
              ],
            },
          },
        },
        {
          id: 'a1',
          type: 'ACTION',
          data: {
            type: 'SEND_WHATSAPP',
            recipient: 'PARENT',
            body: 'Dear {{parent_name}}, fee for {{student_name}} is due on {{due_date}}. Outstanding {{balance_amount}}.',
          },
        },
      ],
      edges: [
        { id: 'e1', source: 't1', target: 'c1' },
        { id: 'e2', source: 'c1', target: 'a1', handle: 'yes' },
      ],
    },
  },
  {
    id: 'result-published',
    name: 'Result published',
    description: 'Notify student and parent when results are published.',
    module: 'EXAMINATION',
    triggerType: 'EVENT',
    triggerEvent: 'exam.result.published',
    graph: {
      nodes: [
        { id: 't1', type: 'TRIGGER', data: { event: 'exam.result.published' } },
        {
          id: 'a1',
          type: 'ACTION',
          data: {
            type: 'SEND_PUSH',
            recipient: 'STUDENT',
            title: 'Examination result',
            body: 'Your examination result is now available.',
          },
        },
        {
          id: 'a2',
          type: 'ACTION',
          data: {
            type: 'SEND_WHATSAPP',
            recipient: 'PARENT',
            body: 'Dear {{parent_name}}, examination results for {{student_name}} are now available in the school app.',
          },
        },
      ],
      edges: [
        { id: 'e1', source: 't1', target: 'a1' },
        { id: 'e2', source: 'a1', target: 'a2' },
      ],
    },
  },
  {
    id: 'birthday',
    name: 'Birthday greeting',
    description: 'Daily birthday wishes to parents.',
    module: 'EVENTS',
    triggerType: 'RECURRING',
    triggerEvent: 'student.birthday',
    scheduleJson: { frequency: 'DAILY', time: '07:00' },
    graph: {
      nodes: [
        { id: 't1', type: 'TRIGGER', data: { event: 'student.birthday' } },
        {
          id: 'a1',
          type: 'ACTION',
          data: {
            type: 'SEND_WHATSAPP',
            recipient: 'PARENT',
            body: 'Happy birthday to {{student_name}} from everyone at {{school_name}}.',
          },
        },
      ],
      edges: [{ id: 'e1', source: 't1', target: 'a1' }],
    },
  },
];

export function renderTemplate(
  body: string,
  vars: Record<string, string | number | undefined>,
) {
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) =>
    vars[key] == null ? '' : String(vars[key]),
  );
}

export function evalConditionGroup(
  group: ConditionGroup | undefined,
  ctx: Record<string, unknown>,
): boolean {
  if (!group?.items?.length) return true;
  const results = group.items.map((item) => {
    if ('op' in item && (item.op === 'AND' || item.op === 'OR')) {
      return evalConditionGroup(item, ctx);
    }
    return evalLeaf(item as ConditionLeaf, ctx);
  });
  return group.op === 'OR' ? results.some(Boolean) : results.every(Boolean);
}

function evalLeaf(leaf: ConditionLeaf, ctx: Record<string, unknown>) {
  const raw = ctx[leaf.field];
  const value = leaf.value;
  const str = raw == null ? '' : String(raw);
  switch (leaf.operator) {
    case 'eq':
      return (
        String(raw ?? '').toLowerCase() === String(value ?? '').toLowerCase()
      );
    case 'neq':
      return (
        String(raw ?? '').toLowerCase() !== String(value ?? '').toLowerCase()
      );
    case 'gt':
      return Number(raw) > Number(value);
    case 'lt':
      return Number(raw) < Number(value);
    case 'gte':
      return Number(raw) >= Number(value);
    case 'lte':
      return Number(raw) <= Number(value);
    case 'contains':
      return str.toLowerCase().includes(String(value ?? '').toLowerCase());
    case 'not_contains':
      return !str.toLowerCase().includes(String(value ?? '').toLowerCase());
    case 'starts_with':
      return str.toLowerCase().startsWith(String(value ?? '').toLowerCase());
    case 'ends_with':
      return str.toLowerCase().endsWith(String(value ?? '').toLowerCase());
    case 'is_empty':
      return raw == null || str === '';
    case 'not_empty':
      return raw != null && str !== '';
    case 'in':
      return (Array.isArray(value) ? value : String(value ?? '').split(','))
        .map((v) => String(v).trim().toLowerCase())
        .includes(str.toLowerCase());
    case 'not_in':
      return !(Array.isArray(value) ? value : String(value ?? '').split(','))
        .map((v) => String(v).trim().toLowerCase())
        .includes(str.toLowerCase());
    default:
      return true;
  }
}

export function parseNaturalWorkflow(text: string) {
  const t = text.toLowerCase();
  if (t.includes('absent'))
    return WORKFLOW_PRESETS.find((p) => p.id === 'absence-alert');
  if (t.includes('fee') && (t.includes('due') || t.includes('remind')))
    return WORKFLOW_PRESETS.find((p) => p.id === 'fee-reminder');
  if (t.includes('result'))
    return WORKFLOW_PRESETS.find((p) => p.id === 'result-published');
  if (t.includes('birthday'))
    return WORKFLOW_PRESETS.find((p) => p.id === 'birthday');
  return WORKFLOW_PRESETS[0];
}

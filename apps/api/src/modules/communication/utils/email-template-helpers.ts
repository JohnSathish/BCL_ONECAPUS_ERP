/** Shared HTML helpers for communication email bodies and the branded shell. */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Strip scripts, event handlers, and javascript: URLs from template HTML. */
export function sanitizeEmailHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/data\s*:\s*text\/html/gi, '');
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

export function emailInfoRows(
  rows: Array<{ label: string; value: string }>,
): string {
  const cells = rows
    .map(
      (row) => `
      <tr>
        <td style="padding:10px 14px;border-bottom:1px solid #e8eef5;font-size:12px;color:#64748b;width:38%;vertical-align:top;">${row.label}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e8eef5;font-size:14px;color:#0f172a;font-weight:600;vertical-align:top;">${row.value}</td>
      </tr>`,
    )
    .join('');
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:16px 0;border:1px solid #dbe4f0;border-radius:12px;overflow:hidden;background:#ffffff;">
    ${cells}
  </table>`;
}

export function emailCtaButton(label: string, href = '{{login_url}}'): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
    <tr>
      <td align="center" bgcolor="#1d4ed8" style="border-radius:10px;">
        <a href="${href}" target="_blank" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;font-family:Segoe UI,Arial,sans-serif;">
          ${label}
        </a>
      </td>
    </tr>
  </table>`;
}

export function emailGreeting(
  nameVar = '{{student_name}}',
  institutionVar = '{{institution_name}}',
): string {
  return `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#334155;">Dear ${nameVar},</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">Greetings from ${institutionVar}.</p>`;
}

export const SAMPLE_EMAIL_VARIABLES: Record<string, string> = {
  student_name: 'John Sathish',
  staff_name: 'Mary Lyngdoh',
  parent_name: 'Mr. Sathish Kumar',
  roll_number: 'BC24-021',
  admission_number: 'ADM-2024-118',
  department: 'Economics',
  programme: 'B.A. Economics',
  semester: 'III',
  academic_year: '2026-2027',
  fee_amount: '₹12,500.00',
  receipt_number: 'RCPT-2026-00421',
  payment_date: '11 Jul 2026',
  examination_name: 'End Semester Examination — July 2026',
  otp: '482913',
  login_url: 'https://portal.example.edu/login',
  attendance_percent: '68%',
  due_date: '25 Jul 2026',
  library_fine: '₹40.00',
  institution_name: 'Don Bosco College, Tura',
  institution_address: 'Don Bosco College, Tura, Meghalaya',
  institution_website: 'https://www.dbc.edu.in',
  institution_email: 'office@dbc.edu.in',
  institution_phone: '+91 00000 00000',
  application_number: 'APP-2026-0912',
  program_name: 'B.A. Economics',
  temp_password: 'BC24-021',
  leave_status: 'Approved',
  meeting_title: 'Department Faculty Meeting',
  meeting_datetime: '15 Jul 2026, 11:00 AM',
  circular_title: 'Holiday Notice — Independence Day',
  report_summary: '12 payments successful · 2 failed · backup OK',
  expiry_date: '31 Dec 2026',
  days_remaining: '15',
  renewal_contact: 'licensing@basecodelabs.com',
};

/** Snake_case placeholders for editors (templates + compose). */
export const EMAIL_MESSAGE_VARIABLES = [
  { key: 'student_name', label: 'Student Name' },
  { key: 'staff_name', label: 'Staff Name' },
  { key: 'parent_name', label: 'Parent Name' },
  { key: 'roll_number', label: 'Roll Number' },
  { key: 'admission_number', label: 'Admission Number' },
  { key: 'department', label: 'Department' },
  { key: 'programme', label: 'Programme' },
  { key: 'semester', label: 'Semester' },
  { key: 'academic_year', label: 'Academic Year' },
  { key: 'fee_amount', label: 'Fee Amount' },
  { key: 'receipt_number', label: 'Receipt Number' },
  { key: 'payment_date', label: 'Payment Date' },
  { key: 'examination_name', label: 'Examination Name' },
  { key: 'otp', label: 'OTP' },
  { key: 'login_url', label: 'Login URL' },
  { key: 'attendance_percent', label: 'Attendance %' },
  { key: 'due_date', label: 'Due Date' },
  { key: 'library_fine', label: 'Library Fine' },
  { key: 'institution_name', label: 'Institution Name' },
  { key: 'application_number', label: 'Application Number' },
  { key: 'program_name', label: 'Programme Name' },
] as const;

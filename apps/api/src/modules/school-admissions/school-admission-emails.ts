export function schoolOtpEmailHtml(input: {
  schoolName: string;
  childName: string;
  otp: string;
  minutes: number;
}): string {
  return schoolEmailLayout({
    schoolName: input.schoolName,
    preheader: `Your Tura Public School admission verification code is ${input.otp}`,
    title: 'Verify your email',
    bodyHtml: `
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">
        Dear Parent / Guardian,
      </p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">
        Use this one-time code to complete K.G. 2027 online registration for
        <strong>${escapeHtml(input.childName || 'your child')}</strong>.
      </p>
      <div style="margin:24px 0;padding:16px 20px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;text-align:center;">
        <div style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#166534;">Email OTP</div>
        <div style="margin-top:8px;font-size:32px;letter-spacing:0.28em;font-weight:700;color:#1b4d3e;">${escapeHtml(input.otp)}</div>
        <div style="margin-top:8px;font-size:13px;color:#64748b;">Valid for ${input.minutes} minutes</div>
      </div>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">
        If you did not start a Tura Public School admission application, you can ignore this email.
      </p>
    `,
  });
}

export function schoolCredentialsEmailHtml(input: {
  schoolName: string;
  childName: string;
  username: string;
  password: string;
  loginUrl: string;
}): string {
  return schoolEmailLayout({
    schoolName: input.schoolName,
    preheader: `Your K.G. 2027 admission login for ${input.username}`,
    title: 'Your admission portal login',
    bodyHtml: `
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">
        Dear Parent / Guardian of <strong>${escapeHtml(input.childName)}</strong>,
      </p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">
        Registration on the Tura Public School online admission portal is complete.
        Please keep these details safe. Use the application number as the bank transfer reference.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;border-collapse:separate;border-spacing:0 8px;">
        ${credentialRow('Username / Application no.', input.username)}
        ${credentialRow('Password', input.password)}
      </table>
      <p style="margin:0 0 24px;text-align:center;">
        <a href="${escapeHtml(input.loginUrl)}" style="display:inline-block;background:#1b4d3e;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;font-size:14px;">
          Open admission login
        </a>
      </p>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">
        Next steps: pay the admission fee to the school account, upload the receipt, complete the
        application form, and upload the required certificates.
      </p>
    `,
  });
}

export function schoolSubmissionEmailHtml(input: {
  schoolName: string;
  childName: string;
  applicationNumber: string;
  submissionDate: string;
}): string {
  return schoolEmailLayout({
    schoolName: input.schoolName,
    preheader: `K.G. Admission 2027 application ${input.applicationNumber} submitted`,
    title: 'Application submitted successfully',
    bodyHtml: `
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">
        Dear Parent/Guardian,
      </p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">
        Thank you for submitting the K.G. Admission application for Academic Session 2027 at
        Tura Public School, Tura.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;border-collapse:separate;border-spacing:0 8px;">
        ${credentialRow('Application Number', input.applicationNumber)}
        ${credentialRow('Applicant Name', input.childName)}
        ${credentialRow('Submission Date', input.submissionDate)}
      </table>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">
        Your application has been successfully submitted.
      </p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">
        Please find the completed application form attached to this email for your records.
      </p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">
        Please keep your Application Number safe for future communication with the school.
      </p>
      <p style="margin:0;font-size:15px;line-height:1.6;color:#334155;">
        Regards,<br />
        Admission Office<br />
        Tura Public School, Tura<br />
        info@turapublicschool.com
      </p>
    `,
  });
}

function credentialRow(label: string, value: string): string {
  return `
    <tr>
      <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;">
        <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">${escapeHtml(label)}</div>
        <div style="margin-top:4px;font-size:16px;font-weight:700;color:#0f172a;font-family:ui-monospace,Consolas,monospace;">${escapeHtml(value)}</div>
      </td>
    </tr>
  `;
}

function schoolEmailLayout(input: {
  schoolName: string;
  preheader: string;
  title: string;
  bodyHtml: string;
}): string {
  const school = escapeHtml(input.schoolName);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(input.title)}</title>
</head>
<body style="margin:0;padding:0;background:#0f241c;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f241c;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#1b4d3e,#14382d);padding:22px 28px;color:#ffffff;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td valign="middle" style="padding-right:16px;">
                    <img src="cid:tps-logo" width="72" height="90" alt="Tura Public School" style="display:block;border:0;width:72px;height:auto;" />
                  </td>
                  <td valign="middle">
                    <div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#c5a572;">TPS Tura</div>
                    <div style="margin-top:6px;font-size:22px;font-weight:700;">${school}</div>
                    <div style="margin-top:6px;font-size:13px;color:#d1fae5;">K.G. Admission · Academic Session 2027</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <h1 style="margin:0 0 16px;font-size:20px;color:#1b4d3e;">${escapeHtml(input.title)}</h1>
              ${input.bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 28px;font-size:12px;line-height:1.6;color:#64748b;">
              Affiliated to the Council for the Indian School Certificate Examinations, New Delhi<br />
              Tura, West Garo Hills, Meghalaya ·
              <a href="https://turapublicschool.com/" style="color:#1b4d3e;">turapublicschool.com</a><br />
              This message was sent by ${school} from info@turapublicschool.com
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

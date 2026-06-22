import { APPOINTMENT_ORDER_STYLES } from './appointment-order.template';

export const INTERVIEW_CALL_LETTER_STYLES = APPOINTMENT_ORDER_STYLES;

export function buildInterviewCallLetterHtml(vars: {
  collegeName: string;
  collegeAddress?: string;
  referenceNo: string;
  letterDate: string;
  candidateName: string;
  fatherName?: string;
  addressText?: string;
  applicationNo: string;
  vacancyTitle: string;
  department?: string;
  interviewDate: string;
  interviewVenue: string;
  panelMembers?: string;
  instructions?: string;
}) {
  const panelBlock = vars.panelMembers
    ? `<p><strong>Interview Panel:</strong> ${vars.panelMembers}</p>`
    : '';
  const instructions =
    vars.instructions ??
    `
    <ol>
      <li>Please report 15 minutes before the scheduled time with original certificates and a set of photocopies.</li>
      <li>Bring this call letter and a valid photo identity proof.</li>
      <li>Failure to appear without prior intimation may lead to cancellation of candidature.</li>
    </ol>
  `;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>${INTERVIEW_CALL_LETTER_STYLES}</style>
</head>
<body>
  <div class="letter">
    <div class="header">
      <h1>${vars.collegeName}</h1>
      ${vars.collegeAddress ? `<div class="sub">${vars.collegeAddress}</div>` : ''}
    </div>
    <div class="meta">
      <span>Ref: ${vars.referenceNo}</span>
      <span>Date: ${vars.letterDate}</span>
    </div>
    <div class="address">
      <p>To,<br/>
      <strong>${vars.candidateName}</strong>${vars.fatherName ? `<br/>S/o ${vars.fatherName}` : ''}
      ${vars.addressText ? `<br/>${vars.addressText}` : ''}</p>
    </div>
    <div class="subject">Sub: Interview Call Letter — ${vars.vacancyTitle}</div>
    <div class="body">
      <p>
        With reference to your application <strong>${vars.applicationNo}</strong> for the post of
        <strong>${vars.vacancyTitle}</strong>${vars.department ? ` (${vars.department})` : ''},
        you are hereby called for an interview as per the details below:
      </p>
      <p>
        <strong>Date &amp; Time:</strong> ${vars.interviewDate}<br/>
        <strong>Venue:</strong> ${vars.interviewVenue}
      </p>
      ${panelBlock}
      <div class="terms">
        <p><strong>Instructions:</strong></p>
        ${instructions}
      </div>
      <p>Yours faithfully,</p>
      <div class="signature">
        <p><strong>Principal / HR Office</strong><br/>${vars.collegeName}</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function buildBulkInterviewCallLettersHtml(letters: string[]) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    ${INTERVIEW_CALL_LETTER_STYLES}
    .letter-page { page-break-after: always; }
    .letter-page:last-child { page-break-after: auto; }
  </style>
</head>
<body>
  ${letters
    .map((inner) => {
      const body = inner
        .replace(/^[\s\S]*<body>/i, '')
        .replace(/<\/body>[\s\S]*$/i, '');
      return `<div class="letter-page">${body}</div>`;
    })
    .join('\n')}
</body>
</html>`;
}

/**
 * College noticeboard routine. Same sheet as the printed FYUGP notice,
 * with blue rules so the 2nd internal is distinct on the notice board.
 */

export type NoticeboardInstitution = {
  name: string;
  displayName?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  affiliation?: string | null;
  phone?: string | null;
  mobile?: string | null;
  email?: string | null;
  website?: string | null;
  accreditation?: string | null;
};

export type NoticeboardRow = {
  slNo: number;
  dateLabel: string;
  dayLabel: string;
  timingLabel: string;
  sem1: string;
  sem3: string;
  sem5: string;
};

export type IaNoticeboardRoutineInput = {
  institution: NoticeboardInstitution;
  examTitle: string;
  shiftLabel: string;
  academicYearLabel?: string | null;
  rows: NoticeboardRow[];
  instructions: string[];
  leftSignatory?: { title: string; subtitle?: string };
  rightSignatory?: { title: string; subtitle?: string };
};

/** Official DBC Tura contacts (fallback when ERP branding has no phone/email). */
export const DBC_TURA_NOTICE_CONTACTS = {
  phone: '03651-222361',
  mobile: '6001816845',
  email: 'principaldbct@gmail.com',
  website: 'www.donboscocollege.ac.in',
  accreditation: "(Re-accredited with 'B' Grade by NAAC)",
  principalName: 'Fr. (Dr.) Jogesh B. Sangma SDB',
} as const;

function esc(value: string | null | undefined) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cell(value: string) {
  const v = value?.trim();
  if (!v || v === '—' || v === '--------') return '--------';
  return esc(v);
}

function isEmptyCell(value: string) {
  const v = value?.trim();
  return !v || v === '—' || v === '--------';
}

function titleLines(title: string): string[] {
  const match = title.match(
    /^(.*)\s+((?:FIRST|\d+(?:ST|ND|RD|TH))\s+INTERNAL ASSESSMENT\s+\d{4})$/i,
  );
  if (!match) return [title];
  return [match[1].trim(), match[2].trim()];
}

function timingHtml(label: string) {
  const match = label.match(/^(MORNING|AFTERNOON)\s+(.+)$/i);
  if (!match) return esc(label);
  const clock = match[2].replace(/\s*-\s*/, ' - ');
  return `<div class="when">${esc(match[1].toUpperCase())}</div><div class="clock">${esc(clock)}</div>`;
}

export function renderIaNoticeboardRoutineHtml(
  input: IaNoticeboardRoutineInput,
): string {
  const college = esc(input.institution.displayName || input.institution.name);
  const address = esc(
    input.institution.address || 'Tura, West Garo Hills, Meghalaya — 794002',
  );
  const phone = input.institution.phone || DBC_TURA_NOTICE_CONTACTS.phone;
  const mobile = input.institution.mobile || DBC_TURA_NOTICE_CONTACTS.mobile;
  const email = input.institution.email || DBC_TURA_NOTICE_CONTACTS.email;
  const website = input.institution.website || DBC_TURA_NOTICE_CONTACTS.website;
  const accreditation =
    input.institution.accreditation || DBC_TURA_NOTICE_CONTACTS.accreditation;

  const logo = input.institution.logoUrl
    ? `<img class="logo" src="${esc(input.institution.logoUrl)}" alt="Logo" />`
    : `<div class="logo-fallback" aria-hidden="true">DBC</div>`;

  const titles = titleLines(input.examTitle)
    .map((line) => `<div>${esc(line)}</div>`)
    .join('');

  const rowsHtml = input.rows
    .map((r, idx) => {
      const stripe = idx % 2 === 0 ? 'row-even' : 'row-odd';
      const semCell = (raw: string) =>
        isEmptyCell(raw)
          ? `<td class="c empty">--------</td>`
          : `<td class="c paper">${cell(raw)}</td>`;
      return `
    <tr class="${stripe}">
      <td class="c sl">${r.slNo}</td>
      <td class="c date-cell">
        <div class="date">${esc(r.dateLabel)}</div>
        <div class="day">${esc(r.dayLabel)}</div>
      </td>
      <td class="c timing">${timingHtml(r.timingLabel)}</td>
      ${semCell(r.sem1)}
      ${semCell(r.sem3)}
      ${semCell(r.sem5)}
    </tr>`;
    })
    .join('');

  const instructionsHtml = input.instructions
    .map(
      (line, i) =>
        `<li><span class="badge">${i + 1}</span><span class="txt">${esc(line)}</span></li>`,
    )
    .join('');

  const left = input.leftSignatory ?? {
    title: 'Coordinator,',
    subtitle: 'Examination cell',
  };
  const right = input.rightSignatory ?? {
    title: DBC_TURA_NOTICE_CONTACTS.principalName,
    subtitle: 'Principal',
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(input.examTitle)}</title>
  <style>
    @page { size: A4; margin: 8mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #1a1a1a;
      font-family: "Times New Roman", Times, serif;
      font-size: 12px;
      line-height: 1.3;
      background: #fff;
    }
    .sheet { width: 100%; }
    .header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 4px 8px;
    }
    .logo, .logo-fallback {
      width: 78px;
      height: 78px;
      object-fit: contain;
      flex: 0 0 auto;
    }
    .logo-fallback {
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid #1d4f91;
      border-radius: 50%;
      font-weight: 800;
      color: #1d4f91;
      font-family: "Segoe UI", Arial, sans-serif;
    }
    .head-text { flex: 1; text-align: center; }
    .college {
      font-size: 26px;
      font-weight: 700;
      letter-spacing: 0.2px;
    }
    .addr, .contacts, .affil {
      margin-top: 2px;
      font-size: 12px;
    }
    .affil { font-style: italic; }
    .rules { margin: 0 0 10px; }
    .rules .thick, .rules .thin {
      border: 0;
      border-top: 3px solid #1d4f91;
      margin: 0;
    }
    .rules .thin { border-top-width: 1px; margin-top: 3px; }
    .title {
      text-align: center;
      color: #1d4f91;
      font-size: 18px;
      font-weight: 800;
      letter-spacing: 0.4px;
      text-transform: uppercase;
      line-height: 1.25;
    }
    .shift-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 8px 28px 12px;
    }
    .shift-row .line {
      flex: 1;
      border-top: 2px solid #1d4f91;
    }
    .shift {
      border: 2px solid #1d4f91;
      color: #1d4f91;
      border-radius: 999px;
      padding: 3px 16px 4px;
      font-weight: 800;
      letter-spacing: 0.8px;
      font-size: 13px;
      text-transform: uppercase;
      background: #fff;
    }
    table.routine {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      color: #1d4f91;
    }
    table.routine th, table.routine td {
      border: 1.5px solid #1d4f91;
      padding: 6px 4px;
      vertical-align: middle;
      text-align: center;
    }
    table.routine thead th {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.2px;
      background: #163a6b;
      color: #fff;
    }
    table.routine thead tr:nth-child(2) th {
      background: #e7f0fa;
      color: #163a6b;
    }
    .sl, .date, .day, .paper, .when, .clock { font-weight: 700; }
    .date { font-size: 13px; }
    .day { margin-top: 2px; font-size: 12px; letter-spacing: 0.3px; }
    .when { font-size: 12px; letter-spacing: 0.4px; }
    .clock { margin-top: 2px; font-size: 12px; }
    .paper { font-size: 13px; font-weight: 800; }
    .empty { letter-spacing: 1px; font-weight: 700; }
    .instr-wrap {
      margin-top: 14px;
      border: 2px solid #1d4f91;
      border-radius: 12px;
      overflow: hidden;
    }
    .instr-head {
      background: #1d4f91;
      color: #fff;
      text-align: center;
      font-weight: 800;
      letter-spacing: 0.6px;
      padding: 6px 8px;
      text-transform: uppercase;
      font-size: 13px;
    }
    ol.instr {
      margin: 0;
      padding: 8px 12px 10px;
      list-style: none;
    }
    ol.instr li {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin: 6px 0;
    }
    .badge {
      flex: 0 0 auto;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #1d4f91;
      color: #fff;
      font-size: 11px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-top: 1px;
      font-family: "Segoe UI", Arial, sans-serif;
    }
    .txt { font-size: 13px; }
    .signs {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      padding: 36px 8px 4px;
    }
    .sign { width: 42%; text-align: center; }
    .sign .space {
      height: 28px;
      border-bottom: 1.5px dotted #1d4f91;
      margin-bottom: 6px;
    }
    .sign .name { font-weight: 700; font-size: 13px; }
    .sign .role { font-size: 12px; }
  </style>
</head>
<body>
  <div class="sheet">
    <header class="header">
      ${logo}
      <div class="head-text">
        <div class="college">${college}</div>
        <div class="addr">${address}</div>
        <div class="contacts">Ph. ${esc(phone)} &nbsp;|&nbsp; Mob. ${esc(mobile)}</div>
        <div class="contacts">Email: ${esc(email)} &nbsp;|&nbsp; Website: ${esc(website)}</div>
        <div class="affil">${esc(accreditation)}</div>
      </div>
    </header>
    <div class="rules"><hr class="thick" /><hr class="thin" /></div>

    <div class="title">${titles}</div>
    <div class="shift-row">
      <span class="line"></span>
      <span class="shift">${esc(input.shiftLabel)}</span>
      <span class="line"></span>
    </div>

    <table class="routine">
      <thead>
        <tr>
          <th rowspan="2" style="width:8%">Sl. No.</th>
          <th rowspan="2" style="width:18%">Date &amp; Day of Examinations</th>
          <th rowspan="2" style="width:16%">Timing</th>
          <th colspan="3">Examinations for the courses to be held</th>
        </tr>
        <tr>
          <th style="width:19.3%">1st Semester</th>
          <th style="width:19.3%">3rd Semester</th>
          <th style="width:19.3%">5th Semester</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <div class="instr-wrap">
      <div class="instr-head">Instructions for the test</div>
      <ol class="instr">
        ${instructionsHtml}
      </ol>
    </div>

    <div class="signs">
      <div class="sign">
        <div class="space"></div>
        <div class="name">${esc(left.title)}</div>
        ${left.subtitle ? `<div class="role">${esc(left.subtitle)}</div>` : ''}
      </div>
      <div class="sign">
        <div class="space"></div>
        <div class="name">${esc(right.title)}</div>
        ${right.subtitle ? `<div class="role">${esc(right.subtitle)}</div>` : ''}
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Colorful DBC-blue noticeboard routine HTML (FYUGP First IA Morning / Day).
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

  const isMorning = /morning/i.test(input.shiftLabel);
  const shiftTone = isMorning ? 'shift-morning' : 'shift-day';

  const rowsHtml = input.rows
    .map((r, idx) => {
      const stripe = idx % 2 === 0 ? 'row-even' : 'row-odd';
      const semCell = (raw: string) =>
        isEmptyCell(raw)
          ? `<td class="c empty">--------</td>`
          : `<td class="c paper"><span class="chip">${cell(raw)}</span></td>`;
      return `
    <tr class="${stripe}">
      <td class="c sl">${r.slNo}</td>
      <td class="c date-cell">
        <div class="date">${esc(r.dateLabel)}</div>
        <div class="day">${esc(r.dayLabel)}</div>
      </td>
      <td class="c timing"><span class="time-pill">${esc(r.timingLabel)}</span></td>
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
    @page { size: A4; margin: 10mm; }
    :root {
      --navy: #0b3d6e;
      --navy-deep: #062846;
      --gold: #c9a227;
      --gold-soft: #f7efd2;
      --sky: #e8f1fa;
      --ink: #142033;
      --muted: #4a5a70;
      --line: #9bb4ce;
      --white: #ffffff;
      --stripe: #f4f8fc;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--ink);
      font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      font-size: 12px;
      line-height: 1.35;
      background: var(--white);
    }
    .sheet {
      width: 100%;
      border: 2px solid var(--navy);
      border-radius: 6px;
      overflow: hidden;
    }
    .topbar {
      height: 6px;
      background: linear-gradient(90deg, var(--navy-deep), var(--navy) 45%, var(--gold));
    }
    .header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 12px 14px 10px;
      background:
        linear-gradient(180deg, #ffffff 0%, var(--sky) 100%);
      border-bottom: 3px solid var(--gold);
    }
    .logo, .logo-fallback {
      width: 78px;
      height: 78px;
      object-fit: contain;
      flex: 0 0 auto;
      border-radius: 50%;
      background: var(--white);
      border: 2px solid var(--gold);
      box-shadow: 0 1px 3px rgba(11, 61, 110, 0.18);
    }
    .logo-fallback {
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      color: var(--navy);
      letter-spacing: 0.5px;
      font-size: 16px;
    }
    .head-text { flex: 1; text-align: center; }
    .college {
      font-size: 20px;
      font-weight: 800;
      color: var(--navy-deep);
      letter-spacing: 0.3px;
      text-transform: none;
    }
    .addr {
      margin-top: 3px;
      font-size: 11px;
      color: var(--muted);
      font-weight: 600;
    }
    .contacts {
      margin-top: 6px;
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 6px 10px;
    }
    .contact-pill {
      display: inline-block;
      padding: 3px 9px;
      border-radius: 999px;
      background: var(--white);
      border: 1px solid var(--line);
      color: var(--navy);
      font-size: 10.5px;
      font-weight: 650;
    }
    .affil {
      margin-top: 7px;
      font-size: 11px;
      font-style: italic;
      color: var(--navy);
      font-weight: 600;
    }
    .title-block {
      padding: 12px 14px 8px;
      text-align: center;
      background: var(--white);
    }
    .title {
      display: inline-block;
      font-size: 13.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: var(--navy-deep);
      border-bottom: 2px solid var(--gold);
      padding-bottom: 3px;
    }
    .shift {
      margin-top: 8px;
      display: inline-block;
      padding: 4px 16px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: var(--white);
    }
    .shift-morning { background: linear-gradient(90deg, #0b3d6e, #1a6bb5); }
    .shift-day { background: linear-gradient(90deg, #8a5a00, #c9a227); color: #1a1400; }
    .table-wrap { padding: 0 10px 10px; }
    table.routine {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      border: 1.5px solid var(--navy);
    }
    table.routine th, table.routine td {
      border: 1px solid var(--line);
      padding: 7px 4px;
      vertical-align: middle;
    }
    table.routine thead th {
      background: linear-gradient(180deg, #134a7c, var(--navy));
      color: var(--white);
      font-size: 10.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    table.routine thead th.group-head {
      background: linear-gradient(180deg, #c9a227, #a8871a);
      color: #1a1400;
      font-size: 11px;
    }
    .c { text-align: center; }
    .sl {
      font-weight: 800;
      color: var(--navy);
      background: var(--gold-soft);
    }
    .row-even { background: var(--white); }
    .row-odd { background: var(--stripe); }
    .date { font-weight: 800; color: var(--navy-deep); font-size: 12px; }
    .day {
      margin-top: 2px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.4px;
      color: #b45309;
    }
    .time-pill {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 6px;
      background: #def0ff;
      border: 1px solid #8cbcde;
      color: var(--navy-deep);
      font-size: 10.5px;
      font-weight: 700;
      white-space: nowrap;
    }
    .chip {
      display: inline-block;
      min-width: 62px;
      padding: 3px 8px;
      border-radius: 6px;
      background: linear-gradient(180deg, #ffffff, #e7f0fa);
      border: 1px solid #9dbad4;
      color: var(--navy-deep);
      font-weight: 800;
      font-size: 11px;
      letter-spacing: 0.3px;
    }
    .empty {
      color: #94a3b8;
      font-weight: 600;
      letter-spacing: 1px;
    }
    .instr-wrap {
      margin: 4px 12px 8px;
      padding: 10px 12px;
      border-radius: 8px;
      background: linear-gradient(180deg, #fffdf5, var(--gold-soft));
      border: 1px solid #e2c766;
    }
    .instr-wrap h3 {
      margin: 0 0 8px;
      font-size: 12.5px;
      color: var(--navy-deep);
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    ol.instr {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    ol.instr li {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin: 5px 0;
    }
    .badge {
      flex: 0 0 auto;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: var(--navy);
      color: var(--white);
      font-size: 10px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-top: 1px;
    }
    .txt { font-size: 12px; color: var(--ink); font-weight: 550; }
    .signs {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      padding: 28px 18px 16px;
    }
    .sign { width: 42%; }
    .sign.right { text-align: right; }
    .sign .space {
      height: 42px;
      border-bottom: 1.5px dashed var(--line);
      margin-bottom: 6px;
    }
    .sign .name {
      font-weight: 800;
      color: var(--navy-deep);
      font-size: 12.5px;
    }
    .sign .role {
      font-size: 11px;
      color: var(--muted);
      font-weight: 650;
    }
    .footer-bar {
      height: 5px;
      background: linear-gradient(90deg, var(--gold), var(--navy));
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="topbar"></div>
    <header class="header">
      ${logo}
      <div class="head-text">
        <div class="college">${college}</div>
        <div class="addr">${address}</div>
        <div class="contacts">
          <span class="contact-pill">Ph. ${esc(phone)}</span>
          <span class="contact-pill">Mob. ${esc(mobile)}</span>
          <span class="contact-pill">Email: ${esc(email)}</span>
          <span class="contact-pill">Website: ${esc(website)}</span>
        </div>
        <div class="affil">${esc(accreditation)}</div>
      </div>
    </header>

    <div class="title-block">
      <div class="title">${esc(input.examTitle)}</div>
      <div><span class="shift ${shiftTone}">${esc(input.shiftLabel)}</span></div>
    </div>

    <div class="table-wrap">
      <table class="routine">
        <thead>
          <tr>
            <th rowspan="2" style="width:7%">SL NO.</th>
            <th rowspan="2" style="width:17%">DATE &amp; DAY</th>
            <th rowspan="2" style="width:18%">TIMING</th>
            <th colspan="3" class="group-head">Examinations for the courses to be held</th>
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
    </div>

    <div class="instr-wrap">
      <h3>Instructions for the test</h3>
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
      <div class="sign right">
        <div class="space"></div>
        <div class="name">${esc(right.title)}</div>
        ${right.subtitle ? `<div class="role">${esc(right.subtitle)}</div>` : ''}
      </div>
    </div>
    <div class="footer-bar"></div>
  </div>
</body>
</html>`;
}

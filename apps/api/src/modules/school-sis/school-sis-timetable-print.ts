import { dayName, printedRange } from './school-sis-timetable-bells';

type Bell = {
  id: string;
  kind: string;
  label: string;
  startTime: string;
  endTime: string;
};

type Slot = {
  sectionId: string;
  bellId: string;
  dayOfWeek: number;
  subject?: { name: string } | null;
  staff?: { fullName: string } | null;
  printedSubject?: string | null;
  printedTeacher?: string | null;
  needsConfirmation?: boolean;
};

export function schoolTimetablePrintHtml(input: {
  yearName: string;
  bells: Bell[];
  days: number[];
  sections: Array<{ id: string; label: string }>;
  slots: Slot[];
}) {
  const sheets = input.days
    .map((day) => {
      const rows = input.sections
        .map((section) => {
          const cells = input.bells
            .map((bell) => {
              if (bell.kind === 'BREAK') {
                return `<td class="break">${esc(bell.label)}</td>`;
              }
              const slot = input.slots.find(
                (s) =>
                  s.sectionId === section.id &&
                  s.bellId === bell.id &&
                  s.dayOfWeek === day,
              );
              const subject = slot?.subject?.name || slot?.printedSubject || '';
              const teacher =
                slot?.staff?.fullName || slot?.printedTeacher || '';
              const flag = slot?.needsConfirmation
                ? '<small class="flag">Confirm</small>'
                : '';
              return `<td><b>${esc(subject)}</b><span>${esc(teacher)}</span>${flag}</td>`;
            })
            .join('');
          return `<tr><th>${esc(section.label)}</th>${cells}</tr>`;
        })
        .join('');
      return `<section class="sheet">
        <header>
          <img src="/school-sis/st-lukes-logo.png" alt="" />
          <div>
            <h1>ST. LUKE'S HIGHER SECONDARY SCHOOL</h1>
            <p>TIME TABLE – ${esc(input.yearName.replace(/academic year/i, '').trim() || input.yearName)}</p>
            <h2>${esc(dayName(day).toUpperCase())}</h2>
          </div>
        </header>
        <table>
          <thead>
            <tr>
              <th>Class</th>
              ${input.bells
                .map(
                  (b) =>
                    `<th class="${b.kind === 'BREAK' ? 'break' : ''}">${esc(b.label)}<small>${esc(printedRange(b.startTime, b.endTime))}</small></th>`,
                )
                .join('')}
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </section>`;
    })
    .join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Time Table – ${esc(input.yearName)}</title>
  <style>
    @page { size: A4 landscape; margin: 8mm; }
    body { margin: 0; font-family: "Segoe UI", Calibri, Arial, sans-serif; color: #1a365d; }
    .sheet { page-break-after: always; }
    .sheet:last-child { page-break-after: auto; }
    header { display: flex; gap: 12px; align-items: center; margin-bottom: 8px; }
    header img { width: 46px; height: 46px; }
    h1 { margin: 0; font-size: 16px; letter-spacing: .04em; }
    h2 { margin: 4px 0 0; font-size: 14px; }
    header p { margin: 2px 0 0; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th, td { border: 1px solid #1a365d; padding: 4px 5px; vertical-align: top; }
    thead th { background: #1a365d; color: #fff; font-weight: 700; }
    thead th small { display: block; font-weight: 400; opacity: .9; }
    tbody th { background: #e8eef6; text-align: left; white-space: nowrap; }
    td b { display: block; }
    td span { color: #334155; }
    td.break, th.break { background: #dbeafe; text-align: center; font-weight: 700; }
    .flag { color: #b45309; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>${sheets}</body>
</html>`;
}

function esc(value: string | null | undefined) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function paperTypeLabel(type: unknown): string {
  const t = String(type ?? '').toUpperCase();
  if (t === 'THEORY_PRACTICAL') return 'Theory + Practical';
  if (t === 'THEORY_ONLY') return 'Theory';
  return String(type ?? '—');
}

function money(value: unknown): string {
  return `₹${Number(value ?? 0).toFixed(2)}`;
}

export type ExamReceiptBranding = {
  collegeName: string;
  addressLine: string | null;
  affiliationLine: string | null;
  accreditationLine: string | null;
  establishedYear: string | null;
};

export function buildExamReceiptHtml(input: {
  receiptNo: string;
  issuedAt: Date | string;
  applicationNo: string;
  breakdown: any;
  collegeName?: string | null;
  logoSrc?: string | null;
  qrImageSrc?: string | null;
  branding?: ExamReceiptBranding | null;
}) {
  const b = input.breakdown ?? {};
  const student = b.student ?? {};
  const fees = b.fees ?? {};
  const payment = b.payment ?? {};
  const session = b.session ?? {};
  const current = Array.isArray(b.currentSubjects) ? b.currentSubjects : [];
  const backs = Array.isArray(b.backPapers) ? b.backPapers : [];
  const issued =
    typeof input.issuedAt === 'string'
      ? input.issuedAt
      : new Date(input.issuedAt).toLocaleString('en-IN');

  const branding = input.branding;
  const college = branding?.collegeName ?? input.collegeName ?? 'Institution';
  const addressLine =
    branding?.addressLine ?? 'Tura, West Garo Hills, Meghalaya - 794002';
  const affiliationLine =
    branding?.affiliationLine ?? 'Affiliated to NEHU, Shillong';
  const accreditationLine =
    branding?.accreditationLine ?? "NAAC Re-accredited with Grade 'B'";
  const establishedYear = branding?.establishedYear ?? '1970';
  const metaLine = `(${affiliationLine}) · ${accreditationLine} | ESTD. ${establishedYear}`;

  const semesterRoman =
    student.semesterRoman ??
    (student.semesterNo != null ? String(student.semesterNo) : null);

  const row = (code: string, name: string, type: string, amount: number) =>
    `<tr>
      <td class="code">${escapeHtml(code)}</td>
      <td>${escapeHtml(name)}</td>
      <td>${escapeHtml(paperTypeLabel(type))}</td>
      <td class="amt">${money(amount)}</td>
    </tr>`;

  const logoBlock = input.logoSrc
    ? `<img class="logo" src="${input.logoSrc}" alt="Logo" />`
    : `<div class="logo-ph">DBC</div>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Examination Fee Receipt ${escapeHtml(input.receiptNo)}</title>
  <style>
    @page { size: A4; margin: 8mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      color: #0f172a;
      margin: 0;
      background: #fff;
      font-size: 10.5px;
      line-height: 1.3;
    }
    .sheet { border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; }
    .band {
      background: linear-gradient(135deg, #0b3a6e 0%, #1d4ed8 70%, #2563eb 100%);
      color: #fff;
      padding: 10px 12px;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .logo, .logo-ph {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: #fff;
      object-fit: contain;
      flex-shrink: 0;
    }
    .logo-ph {
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      color: #0b3a6e;
      font-size: 13px;
      border: 2px solid #93c5fd;
    }
    .college h1 {
      margin: 0;
      font-size: 15px;
      font-weight: 800;
      letter-spacing: 0.2px;
      text-transform: uppercase;
      line-height: 1.15;
    }
    .college .addr {
      margin-top: 2px;
      font-size: 9.5px;
      color: #dbeafe;
      font-weight: 600;
    }
    .college .meta {
      margin-top: 1px;
      font-size: 9px;
      color: #bfdbfe;
    }
    .doc-title {
      margin-top: 7px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 10px;
      border-top: 1px solid rgba(255,255,255,0.25);
      padding-top: 6px;
    }
    .doc-title .label {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.3px;
    }
    .doc-title .session {
      font-size: 9.5px;
      color: #dbeafe;
      text-align: right;
      line-height: 1.25;
    }
    .body { padding: 8px 10px 8px; }
    .card {
      border: 1px solid #e2e8f0;
      border-radius: 7px;
      padding: 7px 9px;
      margin-top: 7px;
      background: #f8fafc;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .card.white { background: #fff; }
    .card.subjects { page-break-inside: auto; break-inside: auto; }
    .card h2 {
      margin: 0 0 4px;
      font-size: 10px;
      color: #0b3a6e;
      text-transform: uppercase;
      letter-spacing: 0.35px;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 5px 10px;
      font-size: 10.5px;
    }
    .grid .k { color: #64748b; font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.25px; }
    .grid .v { font-weight: 700; color: #0f172a; margin-top: 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 2px; font-size: 10px; }
    th, td { padding: 4px 5px; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th {
      background: #0b3a6e;
      color: #fff;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.25px;
    }
    tr:nth-child(even) td { background: #f1f5f9; }
    td.code { font-family: Consolas, monospace; font-weight: 700; color: #1e3a8a; }
    td.amt, th.amt { text-align: right; white-space: nowrap; }
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: stretch;
      gap: 10px;
      margin-top: 7px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .footer .card { margin-top: 0; }
    .totals { flex: 1; }
    .totals .line {
      display: flex;
      justify-content: space-between;
      padding: 2px 0;
      color: #334155;
      font-size: 10.5px;
    }
    .totals .total {
      display: flex;
      justify-content: space-between;
      margin-top: 4px;
      padding-top: 4px;
      border-top: 2px solid #0b3a6e;
      font-size: 13px;
      font-weight: 800;
      color: #0b3a6e;
    }
    .pay-note {
      margin-top: 5px;
      font-size: 8.5px;
      color: #64748b;
      word-break: break-all;
      line-height: 1.25;
    }
    .qr-wrap {
      width: 96px;
      text-align: center;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      background: #eff6ff;
      padding: 6px 5px;
      page-break-inside: avoid;
      break-inside: avoid;
      align-self: stretch;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .qr { width: 78px; height: 78px; margin: 0 auto; }
    .qr-label {
      margin-top: 4px;
      font-size: 8px;
      font-weight: 700;
      color: #1e40af;
      text-transform: uppercase;
      letter-spacing: 0.25px;
    }
    .stamp {
      margin-top: 6px;
      font-size: 8.5px;
      color: #64748b;
      text-align: center;
      page-break-inside: avoid;
      break-inside: avoid;
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="band">
      <div class="header">
        ${logoBlock}
        <div class="college">
          <h1>${escapeHtml(college)}</h1>
          <div class="addr">${escapeHtml(addressLine)}</div>
          <div class="meta">${escapeHtml(metaLine)}</div>
        </div>
      </div>
      <div class="doc-title">
        <div class="label">Semester Examination Fee Receipt</div>
        <div class="session">
          ${escapeHtml(session.name ?? 'Examination')}<br/>
          ${escapeHtml(session.cycle ?? '')}${session.academicYearLabel ? ` · ${escapeHtml(session.academicYearLabel)}` : ''}
        </div>
      </div>
    </div>

    <div class="body">
      <div class="card white">
        <div class="grid">
          <div>
            <div class="k">Receipt No</div>
            <div class="v">${escapeHtml(input.receiptNo)}</div>
          </div>
          <div>
            <div class="k">Application No</div>
            <div class="v">${escapeHtml(input.applicationNo)}</div>
          </div>
          <div>
            <div class="k">Issued</div>
            <div class="v">${escapeHtml(issued)}</div>
          </div>
          <div>
            <div class="k">Student</div>
            <div class="v">${escapeHtml(student.name ?? '—')}</div>
          </div>
          <div>
            <div class="k">Roll / Enrollment</div>
            <div class="v">${escapeHtml(student.rollNumber ?? student.enrollmentNumber ?? '—')}</div>
          </div>
          <div>
            <div class="k">Current Semester</div>
            <div class="v">${semesterRoman ? `Semester ${escapeHtml(semesterRoman)}` : '—'}</div>
          </div>
          <div>
            <div class="k">Department</div>
            <div class="v">${escapeHtml(student.department ?? '—')}</div>
          </div>
        </div>
      </div>

      <div class="card white subjects">
        <h2>Current Semester Subjects</h2>
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Subject</th>
              <th>Type</th>
              <th class="amt">Fee</th>
            </tr>
          </thead>
          <tbody>
            ${
              current
                .map((s: any) =>
                  row(
                    s.subjectCode,
                    s.subjectName,
                    s.examPaperType,
                    Number(s.amount),
                  ),
                )
                .join('') || '<tr><td colspan="4">None</td></tr>'
            }
          </tbody>
        </table>
      </div>

      ${
        backs.length
          ? `<div class="card white subjects">
        <h2>Back Papers</h2>
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Subject</th>
              <th>Type</th>
              <th class="amt">Fee</th>
            </tr>
          </thead>
          <tbody>
            ${backs
              .map((s: any) =>
                row(
                  s.subjectCode,
                  `${s.subjectName} (Sem ${s.semesterNo})`,
                  s.examPaperType,
                  Number(s.amount),
                ),
              )
              .join('')}
          </tbody>
        </table>
      </div>`
          : ''
      }

      <div class="footer">
        <div class="card totals">
          <h2>Fee summary</h2>
          <div class="line"><span>Current Semester Fee</span><span>${money(fees.currentSemesterFee)}</span></div>
          <div class="line"><span>Back Paper Fee</span><span>${money(fees.backPaperFee)}</span></div>
          <div class="line"><span>Processing Fee</span><span>${money(fees.processingFee)}</span></div>
          <div class="line"><span>Late Fee</span><span>${money(fees.lateFee)}</span></div>
          <div class="total"><span>Total</span><span>${money(fees.totalFee)}</span></div>
          <div class="pay-note">
            Payment: ${escapeHtml(payment.channel ?? '—')} / ${escapeHtml(payment.mode ?? '—')}
            ${payment.provider ? ` · ${escapeHtml(payment.provider)}` : ''}
            ${payment.transactionId ? ` · Txn ${escapeHtml(payment.transactionId)}` : ''}
          </div>
        </div>
        ${
          input.qrImageSrc
            ? `<div class="qr-wrap">
                <img class="qr" src="${input.qrImageSrc}" alt="QR" />
                <div class="qr-label">Scan to verify</div>
              </div>`
            : ''
        }
      </div>

      <div class="stamp">
        Computer-generated examination fee receipt · Don Bosco College Tura
      </div>
    </div>
  </div>
</body>
</html>`;
}

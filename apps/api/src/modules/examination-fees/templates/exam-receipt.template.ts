export function buildExamReceiptHtml(input: {
  receiptNo: string;
  issuedAt: Date | string;
  applicationNo: string;
  breakdown: any;
  collegeName?: string | null;
  logoSrc?: string | null;
  qrImageSrc?: string | null;
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
  const college = input.collegeName ?? 'Institution';

  const row = (code: string, name: string, type: string, amount: number) =>
    `<tr><td>${code}</td><td>${name}</td><td>${type}</td><td style="text-align:right">₹${Number(amount).toFixed(2)}</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Examination Fee Receipt ${input.receiptNo}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #0f172a; margin: 28px; }
    .header { display: flex; align-items: center; gap: 16px; border-bottom: 2px solid #1e3a8a; padding-bottom: 12px; }
    .header img.logo { width: 72px; height: 72px; object-fit: contain; }
    h1 { font-size: 18px; margin: 0 0 2px; color: #1e3a8a; }
    .muted { color: #64748b; font-size: 12px; }
    .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin-top: 14px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 8px; text-align: left; }
    th { background: #f8fafc; }
    .total { font-size: 16px; font-weight: 700; margin-top: 12px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px; }
    .footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 18px; }
    .qr { width: 120px; height: 120px; }
  </style>
</head>
<body>
  <div class="header">
    ${input.logoSrc ? `<img class="logo" src="${input.logoSrc}" alt="Logo" />` : ''}
    <div>
      <h1>${college}</h1>
      <div class="muted">Semester Examination Fee Receipt</div>
      <div class="muted">${session.name ?? 'Examination'} · ${session.cycle ?? ''} · ${session.academicYearLabel ?? ''}</div>
    </div>
  </div>
  <div class="card grid">
    <div><strong>Receipt No:</strong> ${input.receiptNo}</div>
    <div><strong>Application No:</strong> ${input.applicationNo}</div>
    <div><strong>Student:</strong> ${student.name ?? '—'}</div>
    <div><strong>Roll / Enrollment:</strong> ${student.rollNumber ?? student.enrollmentNumber ?? '—'}</div>
    <div><strong>Department:</strong> ${student.department ?? '—'}</div>
    <div><strong>Issued:</strong> ${issued}</div>
  </div>
  <div class="card">
    <strong>Current Semester Subjects</strong>
    <table>
      <thead><tr><th>Code</th><th>Subject</th><th>Type</th><th>Fee</th></tr></thead>
      <tbody>
        ${current.map((s: any) => row(s.subjectCode, s.subjectName, s.examPaperType, s.amount)).join('') || '<tr><td colspan="4">None</td></tr>'}
      </tbody>
    </table>
  </div>
  <div class="card">
    <strong>Back Papers</strong>
    <table>
      <thead><tr><th>Code</th><th>Subject</th><th>Type</th><th>Fee</th></tr></thead>
      <tbody>
        ${backs.map((s: any) => row(s.subjectCode, `${s.subjectName} (Sem ${s.semesterNo})`, s.examPaperType, s.amount)).join('') || '<tr><td colspan="4">None</td></tr>'}
      </tbody>
    </table>
  </div>
  <div class="footer">
    <div class="card" style="flex:1; margin-right:16px;">
      <div>Current Semester Fee: ₹${Number(fees.currentSemesterFee ?? 0).toFixed(2)}</div>
      <div>Back Paper Fee: ₹${Number(fees.backPaperFee ?? 0).toFixed(2)}</div>
      <div>Processing Fee: ₹${Number(fees.processingFee ?? 0).toFixed(2)}</div>
      <div>Late Fee: ₹${Number(fees.lateFee ?? 0).toFixed(2)}</div>
      <div class="total">Total: ₹${Number(fees.totalFee ?? 0).toFixed(2)}</div>
      <div class="muted" style="margin-top:8px">
        Payment: ${payment.channel ?? '—'} / ${payment.mode ?? '—'}
        ${payment.provider ? ` · ${payment.provider}` : ''}
        ${payment.transactionId ? ` · Txn ${payment.transactionId}` : ''}
      </div>
    </div>
    ${
      input.qrImageSrc
        ? `<div style="text-align:center"><img class="qr" src="${input.qrImageSrc}" alt="QR" /><div class="muted">Scan to verify</div></div>`
        : ''
    }
  </div>
</body>
</html>`;
}

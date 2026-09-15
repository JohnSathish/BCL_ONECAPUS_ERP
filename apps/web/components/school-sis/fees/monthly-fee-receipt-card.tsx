'use client';

const DEFAULT_LOGO = '/school-sis/st-lukes-logo.png';

export function MonthlyFeeReceiptCard({
  copy,
  schoolName,
  schoolAddress,
  monthLabel,
  studentName,
  admissionNumber,
  className,
  receiptNumber,
  academicYear,
  paidAt,
  paymentMode,
  tuition,
  late,
  other,
  discount,
  previous,
  total,
  signatory,
  instructions,
  monthsCovered,
  logoUrl,
  motto,
  otherLabel,
}: {
  copy: string;
  schoolName: string;
  schoolAddress: string;
  monthLabel: string;
  studentName: string;
  admissionNumber: string;
  className: string;
  receiptNumber: string;
  academicYear: string;
  paidAt: string;
  paymentMode: string;
  tuition: number;
  late: number;
  other: number;
  discount: number;
  previous: number;
  total: number;
  signatory?: string | null;
  instructions: string[];
  monthsCovered?: string[];
  logoUrl?: string | null;
  motto?: string | null;
  otherLabel?: string;
}) {
  const amt = (n: number) =>
    Number(n || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const months = monthsCovered?.length ? monthsCovered.join(', ') : monthLabel;
  const copyLabel = copy.toLowerCase().includes('school') ? 'School Copy' : "Parent's Copy";
  const rows = [
    { label: 'Tuition Fee', value: amt(tuition) },
    ...(other || otherLabel === 'Computer Fee'
      ? [{ label: otherLabel || 'Computer Fee', value: amt(other) }]
      : []),
    { label: 'Late Fee', value: amt(late) },
    ...(discount ? [{ label: 'Concession', value: `− ${amt(discount)}` }] : []),
    ...(previous ? [{ label: 'Previous Balance', value: amt(previous) }] : []),
  ];
  return (
    <article className="flex min-h-[32rem] flex-col rounded-xl border-[1.5px] border-[#1a365d] bg-white p-4 text-[#1a365d] shadow-sm print:shadow-none">
      <header className="mb-3 flex items-center gap-3">
        <img src={logoUrl || DEFAULT_LOGO} alt="" className="h-14 w-14 object-contain" />
        <div>
          <h2 className="text-[17px] font-bold leading-tight">{schoolName}</h2>
          <p className="text-[11px] text-slate-600">{schoolAddress}</p>
          <p className="text-[11px] italic">{motto || 'Knowledge · Service · Light'}</p>
        </div>
      </header>
      <div className="mb-3 flex items-center justify-between rounded-md bg-[#1a365d] px-3 py-2 text-white">
        <span className="text-sm font-extrabold tracking-wide">FEE RECEIPT</span>
        <span className="text-right leading-tight">
          <b className="block text-[13px]">{months}</b>
          <span className="text-[10px] text-white/90">Academic Year: {academicYear}</span>
        </span>
      </div>
      <section className="mb-3 space-y-1 rounded-md bg-[#e8eef6] px-3 py-2 text-[13px]">
        <p className="flex justify-between gap-2">
          <span className="text-slate-600">Pupil's Name</span>
          <b>{studentName}</b>
        </p>
        <p className="flex justify-between gap-2">
          <span className="text-slate-600">Admission No.</span>
          <b>{admissionNumber}</b>
        </p>
        <p className="flex justify-between gap-2">
          <span className="text-slate-600">Class & Section</span>
          <b>{className}</b>
        </p>
      </section>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="bg-[#1a365d] text-white">
            <th className="px-2 py-1.5 text-left font-semibold">Particulars</th>
            <th className="px-2 py-1.5 text-right font-semibold">Amount (Rs.)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-slate-200">
              <td className="px-2 py-1.5">{row.label}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{row.value}</td>
            </tr>
          ))}
          <tr className="bg-[#1a365d] font-bold text-white">
            <td className="px-2 py-1.5">Total Amount</td>
            <td className="px-2 py-1.5 text-right tabular-nums">{amt(total)}</td>
          </tr>
        </tbody>
      </table>
      <section className="mt-3 space-y-1 text-[13px]">
        <p className="flex justify-between">
          <span>Receipt No.</span>
          <b>{receiptNumber}</b>
        </p>
        <p className="flex justify-between">
          <span>Payment Mode</span>
          <b>{paymentMode}</b>
        </p>
        <p className="flex justify-between">
          <span>Date & Time</span>
          <b>{paidAt}</b>
        </p>
      </section>
      <div className="mt-3 rounded-lg border border-[#1a365d] p-2 text-[11px] text-slate-700">
        <p className="font-semibold text-[#1a365d]">General Instructions</p>
        <ol className="mt-1 space-y-0.5">
          {instructions.map((item, i) => (
            <li key={item}>
              <b>{i + 1}.</b> {item}
            </li>
          ))}
        </ol>
      </div>
      <footer className="mt-auto flex items-end justify-between pt-4">
        <span className="rounded-full bg-[#1a365d] px-3 py-1 text-[11px] font-bold text-white">
          {copyLabel}
        </span>
        <span className="text-right text-[11px]">
          Signature
          <span className="block text-slate-500">{signatory || 'Authorized Signatory'}</span>
        </span>
      </footer>
      <p className="mt-2 text-[10px] italic text-slate-500">Thank you for your support</p>
    </article>
  );
}

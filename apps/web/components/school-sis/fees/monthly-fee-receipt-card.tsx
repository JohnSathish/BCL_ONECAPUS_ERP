'use client';

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
}) {
  const money = (n: number) =>
    `Rs. ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return (
    <article className="border border-slate-900 bg-white p-4 text-[13px] text-slate-900">
      <header className="mb-2 text-center">
        <p className="font-semibold">{monthLabel}</p>
        <h2 className="text-lg font-bold leading-tight">{schoolName}</h2>
        <p>{schoolAddress}</p>
      </header>
      <p className="flex justify-between border-b border-dotted border-slate-500 py-1">
        <span>Pupil's Name</span>
        <strong>{studentName}</strong>
      </p>
      <p className="flex justify-between border-b border-dotted border-slate-500 py-1">
        <span>Admission No.</span>
        <strong>{admissionNumber}</strong>
      </p>
      <p className="flex justify-between border-b border-dotted border-slate-500 py-1">
        <span>Class</span>
        <strong>{className}</strong>
      </p>
      <table className="mt-2 w-full border-collapse">
        <tbody>
          <tr>
            <td className="border border-slate-900 px-2 py-1">Tuition Fee</td>
            <td className="border border-slate-900 px-2 py-1 text-right">{money(tuition)}</td>
          </tr>
          <tr>
            <td className="border border-slate-900 px-2 py-1">Late Fee</td>
            <td className="border border-slate-900 px-2 py-1 text-right">{money(late)}</td>
          </tr>
          {other ? (
            <tr>
              <td className="border border-slate-900 px-2 py-1">Other Fee</td>
              <td className="border border-slate-900 px-2 py-1 text-right">{money(other)}</td>
            </tr>
          ) : null}
          {discount ? (
            <tr>
              <td className="border border-slate-900 px-2 py-1">Concession</td>
              <td className="border border-slate-900 px-2 py-1 text-right">− {money(discount)}</td>
            </tr>
          ) : null}
          {previous ? (
            <tr>
              <td className="border border-slate-900 px-2 py-1">Previous Balance</td>
              <td className="border border-slate-900 px-2 py-1 text-right">{money(previous)}</td>
            </tr>
          ) : null}
          <tr className="font-bold">
            <td className="border border-slate-900 px-2 py-1">Total Rs.</td>
            <td className="border border-slate-900 px-2 py-1 text-right">{money(total)}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-xs">
        Fee Book {receiptNumber} · {academicYear} · {paymentMode}
      </p>
      <p className="text-xs">Date {paidAt}</p>
      <div className="mt-6 flex justify-between text-sm">
        <span>{copy}</span>
        <span className="text-right">
          Signature
          <br />
          <span className="text-xs text-slate-500">{signatory || 'Authorized signatory'}</span>
        </span>
      </div>
      <div className="mt-3 rounded-xl border border-slate-900 p-2 text-[11px]">
        <p className="font-semibold">General instructions</p>
        <ol className="ml-4 list-decimal">
          {instructions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </div>
    </article>
  );
}

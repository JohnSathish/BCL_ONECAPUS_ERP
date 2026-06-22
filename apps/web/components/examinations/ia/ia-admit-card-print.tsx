'use client';

function dateOnly(value?: string | Date | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString('en-GB').replace(/\//g, '-');
}

function timeOnly(value?: string | Date | null) {
  if (!value) return '—';
  const s = String(value);
  if (/^\d{2}:\d{2}/.test(s)) {
    const [h, m] = s.slice(0, 5).split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hr = h % 12 || 12;
    return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s.slice(0, 5);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
}

export type IaAdmitCardData = {
  blocked?: boolean;
  reason?: string;
  issueId?: string;
  admitCardNumber?: string;
  verifyToken?: string;
  verifyCode?: string;
  verifyUrl?: string;
  institutionName?: string;
  institution?: {
    name?: string;
    displayName?: string | null;
    address?: string | null;
    logoUrl?: string | null;
    affiliation?: string | null;
  };
  session?: {
    name: string;
    examType?: string;
    semesterNo?: number | null;
    academicYear?: string | null;
    instructions?: string | null;
  };
  student?: {
    fullName?: string | null;
    rollNumber?: string | null;
    enrollmentNumber?: string | null;
    admissionNumber?: string | null;
    abcId?: string | null;
    programme?: string | null;
    department?: string | null;
    semesterNo?: number | null;
    gender?: string | null;
    dateOfBirth?: string | null;
    fatherName?: string | null;
    motherName?: string | null;
    photoUrl?: string | null;
    programmeCode?: string | null;
  };
  papers?: Array<{
    paperCode: string;
    paperName: string;
    paperType?: string | null;
    maxMarks?: number | null;
    examDate: string | Date;
    startTime: string | Date;
    endTime: string | Date;
  }>;
  qrPayload?: string;
  generatedAt?: string;
  eligibility?: {
    eligible?: boolean;
    reasons?: string[];
  };
};

const DEFAULT_INSTRUCTIONS = [
  'Report to the examination hall 15 minutes before the scheduled time.',
  'Carry this admit card and valid college ID without fail.',
  'Mobile phones and electronic devices are strictly prohibited.',
  'Use only blue/black ink pen unless otherwise instructed.',
  'Malpractice will lead to cancellation of examination.',
];

function QrImage({ value }: { value?: string | null }) {
  if (!value) return null;
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(value)}`;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Verification QR"
      className="h-[72px] w-[72px] rounded border border-slate-200"
    />
  );
}

export function IaAdmitCardPrint({ card }: { card: IaAdmitCardData }) {
  if (card.blocked) {
    return (
      <div className="ia-admit-card rounded-2xl border-2 border-dashed border-rose-300 bg-rose-50 p-6 text-center print:break-after-page">
        <p className="text-sm font-semibold text-rose-800">Admit card blocked</p>
        <p className="mt-1 text-xs text-rose-700">{card.reason}</p>
        {card.eligibility?.reasons?.length ? (
          <ul className="mt-2 space-y-1 text-left text-xs text-rose-700">
            {card.eligibility.reasons.map((r) => (
              <li key={r}>• {r}</li>
            ))}
          </ul>
        ) : null}
        <p className="mt-2 text-sm">{card.student?.fullName ?? 'Student'}</p>
      </div>
    );
  }

  const inst = card.institution;
  const displayName = inst?.displayName ?? card.institutionName ?? 'College';
  const instructions = card.session?.instructions
    ? card.session.instructions.split(/\n+/).filter(Boolean)
    : DEFAULT_INSTRUCTIONS;
  const qrTarget = card.verifyUrl ?? card.qrPayload ?? '';

  return (
    <article className="ia-admit-card relative mx-auto w-full max-w-[210mm] overflow-hidden rounded-xl border-2 border-[#1e3a8a] bg-white p-5 text-slate-900 shadow-sm print:max-w-none print:rounded-none print:shadow-none">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center text-6xl font-bold text-[#1e3a8a]/[0.04] rotate-[-28deg]"
      >
        {displayName.slice(0, 24)}
      </div>

      <header className="relative flex gap-3 border-b-2 border-[#1e3a8a] pb-3">
        {inst?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={inst.logoUrl}
            alt=""
            className="h-16 w-16 rounded border border-slate-200 object-contain bg-slate-50"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded border border-slate-200 bg-slate-50 text-[10px] text-slate-400">
            LOGO
          </div>
        )}
        <div className="min-w-0 flex-1 text-center">
          <h2 className="text-lg font-bold uppercase tracking-wide text-[#1e3a8a]">
            {displayName}
          </h2>
          {inst?.affiliation ? (
            <p className="text-[10px] text-slate-600">{inst.affiliation}</p>
          ) : null}
          {inst?.address ? <p className="text-[10px] text-slate-500">{inst.address}</p> : null}
        </div>
        <div className="rounded-md bg-[#1e3a8a] px-2 py-2 text-center text-[9px] font-bold leading-tight text-white">
          INTERNAL
          <br />
          ASSESSMENT
          <br />
          ADMIT CARD
        </div>
      </header>

      <div className="relative mt-3 flex items-start justify-between gap-3 rounded-md border border-blue-100 bg-blue-50/80 px-3 py-2">
        <div>
          <p className="text-sm font-semibold text-[#1e3a8a]">{card.session?.name}</p>
          <p className="text-[10px] text-slate-600">
            Academic Session: {card.session?.academicYear ?? '—'}
          </p>
          {card.session?.semesterNo ? (
            <p className="text-[10px] text-slate-500">Semester {card.session.semesterNo}</p>
          ) : null}
        </div>
        <div className="text-right">
          <p className="font-mono text-[10px] font-bold text-[#1e3a8a]">
            {card.admitCardNumber ?? '—'}
          </p>
          <QrImage value={qrTarget} />
        </div>
      </div>

      <div className="relative mt-3 grid grid-cols-[1fr_110px] gap-3">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
          <Field label="Roll Number" value={card.student?.rollNumber} />
          <Field label="Admission No" value={card.student?.admissionNumber} />
          <Field label="Name" value={card.student?.fullName} className="col-span-2 sm:col-span-1" />
          <Field label="Reg. No" value={card.student?.enrollmentNumber} />
          <Field label="Father's Name" value={card.student?.fatherName} />
          <Field label="ABC ID" value={card.student?.abcId} />
          <Field label="Mother's Name" value={card.student?.motherName} />
          <Field label="Programme" value={card.student?.programme} />
          <Field label="Department" value={card.student?.department} />
          <Field label="Semester" value={card.student?.semesterNo?.toString()} />
          <Field label="Gender" value={card.student?.gender} />
          <Field label="Date of Birth" value={dateOnly(card.student?.dateOfBirth)} />
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-center">
          {card.student?.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={card.student.photoUrl}
              alt=""
              className="mx-auto h-[100px] w-[84px] border border-slate-300 object-cover"
            />
          ) : (
            <div className="mx-auto h-[100px] w-[84px] border border-slate-300 bg-slate-200" />
          )}
          <p className="mt-2 border-t border-slate-400 pt-1 text-[9px] italic text-slate-600">
            {card.student?.fullName}
            <br />
            Student Signature
          </p>
        </div>
      </div>

      <table className="relative mt-3 w-full border-collapse text-[10px]">
        <thead>
          <tr className="bg-[#1e3a8a] text-left text-[9px] uppercase text-white">
            <th className="border border-blue-800 px-2 py-1.5">Sl.</th>
            <th className="border border-blue-800 px-2 py-1.5">Paper Code</th>
            <th className="border border-blue-800 px-2 py-1.5">Paper Title</th>
            <th className="border border-blue-800 px-2 py-1.5">Type</th>
            <th className="border border-blue-800 px-2 py-1.5">Max</th>
            <th className="border border-blue-800 px-2 py-1.5">Date</th>
            <th className="border border-blue-800 px-2 py-1.5">Time</th>
          </tr>
        </thead>
        <tbody>
          {(card.papers ?? []).map((p, i) => (
            <tr key={`${p.paperCode}-${i}`} className="even:bg-slate-50">
              <td className="border border-slate-200 px-2 py-1.5">{i + 1}</td>
              <td className="border border-slate-200 px-2 py-1.5 font-semibold">{p.paperCode}</td>
              <td className="border border-slate-200 px-2 py-1.5">{p.paperName}</td>
              <td className="border border-slate-200 px-2 py-1.5">{p.paperType ?? '—'}</td>
              <td className="border border-slate-200 px-2 py-1.5">{p.maxMarks ?? '—'}</td>
              <td className="border border-slate-200 px-2 py-1.5">{dateOnly(p.examDate)}</td>
              <td className="border border-slate-200 px-2 py-1.5">
                {timeOnly(p.startTime)} – {timeOnly(p.endTime)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!card.papers?.length ? (
        <p className="mt-2 text-xs text-slate-500">No scheduled papers for this student.</p>
      ) : null}

      <footer className="relative mt-4 grid grid-cols-[1fr_140px] gap-4 border-t border-slate-200 pt-3 text-[10px]">
        <div>
          <p className="font-semibold text-slate-800">Instructions to Students</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-slate-600">
            {instructions.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        </div>
        <div className="text-center">
          <div className="mt-8 border-t border-slate-600 pt-1 text-[9px] font-semibold">
            Controller of Examinations
          </div>
        </div>
      </footer>
      <p className="relative mt-2 text-center text-[8px] text-slate-500">
        Note: This is a computer generated admit card. QR verification available at college portal.
      </p>
    </article>
  );
}

function Field({
  label,
  value,
  className,
}: {
  label: string;
  value?: string | null;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-[8px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="font-semibold text-slate-900">{value ?? '—'}</p>
    </div>
  );
}

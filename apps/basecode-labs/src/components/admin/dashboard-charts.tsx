function Sparkline({ values, color }: { values: number[]; color: string }) {
  const w = 140;
  const h = 42;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => {
    const x = values.length === 1 ? w : (i / (values.length - 1)) * w;
    const y = h - (v / max) * (h - 4) - 2;
    return `${x},${y}`;
  });
  const d = `M ${pts.join(' L ')}`;
  const area = `M 0,${h} L ${pts.join(' L ')} L ${w},${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-full" aria-hidden>
      <path d={area} fill={color} opacity="0.12" />
      <path d={d} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function VisitorsLineChart({ points }: { points: { label: string; value: number }[] }) {
  const w = 640;
  const h = 220;
  const pad = { l: 28, r: 12, t: 16, b: 28 };
  const max = Math.max(...points.map((p) => p.value), 4);
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const coords = points.map((p, i) => {
    const x = pad.l + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
    const y = pad.t + innerH - (p.value / max) * innerH;
    return { x, y, ...p };
  });
  const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
  const area = `${line} L ${coords[coords.length - 1].x} ${pad.t + innerH} L ${coords[0].x} ${pad.t + innerH} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-[220px] w-full">
      {[0, 0.5, 1].map((t) => (
        <line
          key={t}
          x1={pad.l}
          x2={w - pad.r}
          y1={pad.t + innerH * (1 - t)}
          y2={pad.t + innerH * (1 - t)}
          stroke="#e2e8f0"
          strokeDasharray="4 6"
        />
      ))}
      <path d={area} fill="url(#visFill)" />
      <path d={line} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinejoin="round" />
      {coords.map((c) => (
        <circle
          key={c.label}
          cx={c.x}
          cy={c.y}
          r="4.5"
          fill="#2563eb"
          stroke="#fff"
          strokeWidth="2"
        />
      ))}
      {coords.map((c) => (
        <text
          key={`${c.label}-l`}
          x={c.x}
          y={h - 8}
          textAnchor="middle"
          className="fill-slate-400"
          fontSize="11"
        >
          {c.label}
        </text>
      ))}
      <defs>
        <linearGradient id="visFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function TrafficDonut({
  slices,
  total,
}: {
  slices: { label: string; value: number; color: string }[];
  total: number;
}) {
  const r = 54;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const safeTotal = total || 1;
  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 140 140" className="h-36 w-36 shrink-0">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#e2e8f0" strokeWidth="16" />
        {slices.map((s) => {
          const len = (s.value / safeTotal) * c;
          const el = (
            <circle
              key={s.label}
              cx="70"
              cy="70"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="16"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 70 70)"
              strokeLinecap="butt"
            />
          );
          offset += len;
          return el;
        })}
        <text
          x="70"
          y="66"
          textAnchor="middle"
          className="fill-slate-900"
          fontSize="22"
          fontWeight="700"
        >
          {total}
        </text>
        <text x="70" y="84" textAnchor="middle" className="fill-slate-400" fontSize="10">
          Total views
        </text>
      </svg>
      <ul className="space-y-2 text-sm">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-2 text-slate-600">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
              {s.label}
            </span>
            <span className="font-semibold text-slate-900">
              {s.value}{' '}
              <span className="text-xs font-medium text-slate-400">
                ({total ? Math.round((s.value / total) * 1000) / 10 : 0}%)
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export { Sparkline };

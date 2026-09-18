'use client';

export function PolicySwitcher({
  items,
  current,
}: {
  items: { slug: string; title: string }[];
  current: string;
}) {
  return (
    <label className="mb-4 block text-xs font-semibold uppercase tracking-wide text-slate-500 lg:hidden">
      Policy
      <select
        className="bcl-input mt-1"
        defaultValue={current}
        onChange={(e) => {
          window.location.href = `/legal/${e.target.value}`;
        }}
      >
        {items.map((item) => (
          <option key={item.slug} value={item.slug}>
            {item.title}
          </option>
        ))}
      </select>
    </label>
  );
}

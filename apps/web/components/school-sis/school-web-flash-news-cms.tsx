'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSchoolWebHomepage, patchSchoolWebHomepage } from '@/services/school-web';
import { apiErrorMessage } from '@/utils/api-error';
import {
  parseFlashNewsPayload,
  SCHOOL_FLASH_ICONS,
  SCHOOL_WEB_FLASH_NEWS_MAX,
  type SchoolFlashNewsItem,
} from '@/lib/school-web/flash-news';

const emptyItem = (): SchoolFlashNewsItem => ({
  id: `flash-${Date.now()}`,
  title: '',
  href: '',
  icon: 'notice',
  isNew: false,
  enabled: true,
});

export function SchoolWebFlashNewsCms() {
  const qc = useQueryClient();
  const home = useQuery({ queryKey: ['school-web-home'], queryFn: fetchSchoolWebHomepage });
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [label, setLabel] = useState('FLASH NEWS');
  const [items, setItems] = useState<SchoolFlashNewsItem[]>([]);

  useEffect(() => {
    const section = home.data?.find((s) => s.key === 'flashNews');
    if (!section) {
      setEnabled(true);
      setLabel('FLASH NEWS');
      setItems([]);
      return;
    }
    const parsed = parseFlashNewsPayload(section.payload);
    setEnabled(section.enabled);
    setLabel(parsed.label);
    setItems(parsed.items);
  }, [home.data]);

  const save = useMutation({
    mutationFn: (next: SchoolFlashNewsItem[]) =>
      patchSchoolWebHomepage('flashNews', {
        enabled,
        sortOrder: 15,
        payload: {
          label: label.trim() || 'FLASH NEWS',
          items: next.map((item) => ({
            id: item.id,
            title: item.title.trim(),
            href: item.href.trim() || undefined,
            icon: item.icon,
            isNew: item.isNew,
            enabled: item.enabled,
          })),
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['school-web-home'] });
      setError(null);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const persist = (next: SchoolFlashNewsItem[]) => {
    const missing = next.find((item) => item.enabled !== false && item.title.trim().length < 2);
    if (missing) {
      setItems(next);
      setError('Each enabled flash news item needs a title.');
      return;
    }
    setItems(next);
    save.mutate(next);
  };

  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[#1a365d]">Flash news ticker</h2>
          <p className="mt-1 text-xs text-slate-500">
            Replaces the yellow motto strip under the homepage slider. Items scroll from right to
            left on the public site.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Show on homepage
        </label>
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <label className="mt-3 block text-xs font-semibold text-slate-500">
        Label
        <input
          className="mt-1 h-10 w-full max-w-xs rounded-lg border px-3 text-sm"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </label>
      <div className="mt-3 space-y-3">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="grid gap-2 rounded-xl border p-3 md:grid-cols-[1fr_160px_auto]"
          >
            <label className="text-xs font-semibold text-slate-500">
              Title
              <input
                className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
                value={item.title}
                onChange={(e) =>
                  setItems((list) =>
                    list.map((row) =>
                      row.id === item.id ? { ...row, title: e.target.value } : row,
                    ),
                  )
                }
              />
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Icon
              <select
                className="mt-1 h-10 w-full rounded-lg border px-2 text-sm"
                value={item.icon}
                onChange={(e) =>
                  setItems((list) =>
                    list.map((row) =>
                      row.id === item.id
                        ? { ...row, icon: e.target.value as SchoolFlashNewsItem['icon'] }
                        : row,
                    ),
                  )
                }
              >
                {SCHOOL_FLASH_ICONS.map((icon) => (
                  <option key={icon} value={icon}>
                    {icon}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex h-10 items-center gap-1 text-xs font-semibold text-slate-600">
                <input
                  type="checkbox"
                  checked={item.isNew}
                  onChange={(e) =>
                    setItems((list) =>
                      list.map((row) =>
                        row.id === item.id ? { ...row, isNew: e.target.checked } : row,
                      ),
                    )
                  }
                />
                NEW
              </label>
              <label className="flex h-10 items-center gap-1 text-xs font-semibold text-slate-600">
                <input
                  type="checkbox"
                  checked={item.enabled}
                  onChange={(e) =>
                    setItems((list) =>
                      list.map((row) =>
                        row.id === item.id ? { ...row, enabled: e.target.checked } : row,
                      ),
                    )
                  }
                />
                On
              </label>
              <button
                type="button"
                className="h-10 rounded-lg border px-2 text-xs"
                onClick={() => setItems((list) => list.filter((row) => row.id !== item.id))}
              >
                Remove
              </button>
              <button
                type="button"
                className="h-10 rounded-lg border px-2 text-xs"
                disabled={index === 0}
                onClick={() =>
                  setItems((list) => {
                    const next = [...list];
                    const swap = next[index - 1];
                    next[index - 1] = next[index]!;
                    next[index] = swap!;
                    return next;
                  })
                }
              >
                Up
              </button>
            </div>
            <label className="text-xs font-semibold text-slate-500 md:col-span-3">
              Link (optional — /admissions or a full URL)
              <input
                className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
                value={item.href}
                onChange={(e) =>
                  setItems((list) =>
                    list.map((row) =>
                      row.id === item.id ? { ...row, href: e.target.value } : row,
                    ),
                  )
                }
              />
            </label>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-xl border px-3 py-1.5 text-sm"
          disabled={items.length >= SCHOOL_WEB_FLASH_NEWS_MAX}
          onClick={() =>
            setItems((list) =>
              list.length >= SCHOOL_WEB_FLASH_NEWS_MAX ? list : [...list, emptyItem()],
            )
          }
        >
          Add item
        </button>
        <button
          type="button"
          className="rounded-xl bg-[#2563eb] px-3 py-1.5 text-sm font-semibold text-white"
          onClick={() => persist(items)}
          disabled={save.isPending}
        >
          {save.isPending ? 'Saving…' : 'Save flash news'}
        </button>
      </div>
    </div>
  );
}

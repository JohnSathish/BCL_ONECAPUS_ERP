'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSchoolWebHomepage, patchSchoolWebHomepage } from '@/services/school-web';
import { apiErrorMessage } from '@/utils/api-error';

type CardForm = {
  enabled: boolean;
  featured: boolean;
  icon: string;
  iconUrl: string;
  imageUrl: string;
  kicker: string;
  title: string;
  body: string;
  href: string;
  cta: string;
  target: '_self' | '_blank';
};

type FootForm = { icon: string; title: string; text: string };

const emptyCard = (): CardForm => ({
  enabled: true,
  featured: false,
  icon: 'book',
  iconUrl: '',
  imageUrl: '',
  kicker: '',
  title: '',
  body: '',
  href: '',
  cta: '',
  target: '_self',
});

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function SchoolWebExploreCms() {
  const qc = useQueryClient();
  const home = useQuery({ queryKey: ['school-web-home'], queryFn: fetchSchoolWebHomepage });
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [kicker, setKicker] = useState('');
  const [title, setTitle] = useState('');
  const [intro, setIntro] = useState('');
  const [cards, setCards] = useState<CardForm[]>([]);
  const [footerItems, setFooterItems] = useState<FootForm[]>([]);

  useEffect(() => {
    const section = home.data?.find((s) => s.key === 'explore');
    if (!section) return;
    const payload = asRecord(section.payload);
    setEnabled(section.enabled);
    setKicker(String(payload.kicker || ''));
    setTitle(String(payload.title || ''));
    setIntro(String(payload.intro || ''));
    setCards(
      (Array.isArray(payload.cards) ? payload.cards : []).map((raw) => {
        const item = asRecord(raw);
        return {
          enabled: item.enabled !== false,
          featured: Boolean(item.featured),
          icon: String(item.icon || 'book'),
          iconUrl: String(item.iconUrl || ''),
          imageUrl: String(item.imageUrl || ''),
          kicker: String(item.kicker || ''),
          title: String(item.title || ''),
          body: String(item.body || ''),
          href: String(item.href || ''),
          cta: String(item.cta || ''),
          target: item.target === '_blank' ? '_blank' : '_self',
        };
      }),
    );
    setFooterItems(
      (Array.isArray(payload.footerItems) ? payload.footerItems : []).map((raw) => {
        const item = asRecord(raw);
        return {
          icon: String(item.icon || 'book'),
          title: String(item.title || ''),
          text: String(item.text || ''),
        };
      }),
    );
  }, [home.data]);

  const save = useMutation({
    mutationFn: () =>
      patchSchoolWebHomepage('explore', {
        enabled,
        payload: {
          kicker,
          title,
          intro,
          cards: cards.map((card) => ({
            enabled: card.enabled,
            featured: card.featured,
            icon: card.icon,
            iconUrl: card.iconUrl || undefined,
            imageUrl: card.imageUrl || undefined,
            kicker: card.kicker,
            title: card.title,
            body: card.body,
            href: card.href,
            cta: card.cta,
            target: card.target,
          })),
          footerItems: footerItems.filter((item) => item.title.trim()),
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['school-web-home'] });
      setError(null);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const move = (index: number, dir: number) => {
    setCards((list) => {
      const next = [...list];
      const target = index + dir;
      if (target < 0 || target >= next.length) return list;
      const [row] = next.splice(index, 1);
      next.splice(target, 0, row!);
      return next;
    });
  };

  return (
    <form
      className="space-y-4 rounded-2xl border bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div>
        <h2 className="text-sm font-semibold text-[#1a365d]">Explore St. Luke’s</h2>
        <p className="text-xs text-slate-500">
          Homepage navigation cards. Leave a card disabled to hide it without deleting it.
        </p>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Show this section
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs font-semibold text-slate-500">
          Eyebrow
          <input
            className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
            value={kicker}
            onChange={(e) => setKicker(e.target.value)}
          />
        </label>
        <label className="text-xs font-semibold text-slate-500">
          Heading
          <input
            className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
      </div>
      <label className="text-xs font-semibold text-slate-500">
        Description
        <textarea
          className="mt-1 h-20 w-full rounded-lg border p-2 text-sm"
          value={intro}
          onChange={(e) => setIntro(e.target.value)}
        />
      </label>
      <div className="space-y-3">
        {cards.map((card, i) => (
          <div key={i} className="grid gap-2 rounded-xl border p-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded border px-2 py-1 text-xs"
                onClick={() => move(i, -1)}
              >
                Up
              </button>
              <button
                type="button"
                className="rounded border px-2 py-1 text-xs"
                onClick={() => move(i, 1)}
              >
                Down
              </button>
              <button
                type="button"
                className="rounded border px-2 py-1 text-xs text-red-600"
                onClick={() => setCards((list) => list.filter((_, idx) => idx !== i))}
              >
                Delete
              </button>
              <label className="ml-auto flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={card.enabled}
                  onChange={(e) =>
                    setCards((list) =>
                      list.map((row, idx) =>
                        idx === i ? { ...row, enabled: e.target.checked } : row,
                      ),
                    )
                  }
                />
                Enabled
              </label>
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={card.featured}
                  onChange={(e) =>
                    setCards((list) =>
                      list.map((row, idx) =>
                        idx === i ? { ...row, featured: e.target.checked } : row,
                      ),
                    )
                  }
                />
                Featured
              </label>
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              <select
                className="h-10 rounded-lg border px-2 text-sm"
                value={card.icon}
                onChange={(e) =>
                  setCards((list) =>
                    list.map((row, idx) => (idx === i ? { ...row, icon: e.target.value } : row)),
                  )
                }
              >
                {['book', 'cap', 'bell', 'people', 'parents', 'apply', 'sprout', 'building'].map(
                  (icon) => (
                    <option key={icon} value={icon}>
                      {icon}
                    </option>
                  ),
                )}
              </select>
              <input
                className="h-10 rounded-lg border px-3 text-sm"
                placeholder="Custom icon URL"
                value={card.iconUrl}
                onChange={(e) =>
                  setCards((list) =>
                    list.map((row, idx) => (idx === i ? { ...row, iconUrl: e.target.value } : row)),
                  )
                }
              />
              <input
                className="h-10 rounded-lg border px-3 text-sm"
                placeholder="Card photo URL"
                value={card.imageUrl}
                onChange={(e) =>
                  setCards((list) =>
                    list.map((row, idx) =>
                      idx === i ? { ...row, imageUrl: e.target.value } : row,
                    ),
                  )
                }
              />
              <input
                className="h-10 rounded-lg border px-3 text-sm"
                placeholder="Category"
                value={card.kicker}
                onChange={(e) =>
                  setCards((list) =>
                    list.map((row, idx) => (idx === i ? { ...row, kicker: e.target.value } : row)),
                  )
                }
              />
              <input
                className="h-10 rounded-lg border px-3 text-sm"
                placeholder="Title"
                value={card.title}
                onChange={(e) =>
                  setCards((list) =>
                    list.map((row, idx) => (idx === i ? { ...row, title: e.target.value } : row)),
                  )
                }
              />
              <input
                className="h-10 rounded-lg border px-3 text-sm"
                placeholder="URL"
                value={card.href}
                onChange={(e) =>
                  setCards((list) =>
                    list.map((row, idx) => (idx === i ? { ...row, href: e.target.value } : row)),
                  )
                }
              />
              <input
                className="h-10 rounded-lg border px-3 text-sm"
                placeholder="CTA"
                value={card.cta}
                onChange={(e) =>
                  setCards((list) =>
                    list.map((row, idx) => (idx === i ? { ...row, cta: e.target.value } : row)),
                  )
                }
              />
            </div>
            <textarea
              className="h-16 rounded-lg border p-2 text-sm"
              placeholder="Description"
              value={card.body}
              onChange={(e) =>
                setCards((list) =>
                  list.map((row, idx) => (idx === i ? { ...row, body: e.target.value } : row)),
                )
              }
            />
            <label className="text-xs text-slate-500">
              Open in
              <select
                className="ml-2 h-8 rounded border px-2"
                value={card.target}
                onChange={(e) =>
                  setCards((list) =>
                    list.map((row, idx) =>
                      idx === i ? { ...row, target: e.target.value as '_self' | '_blank' } : row,
                    ),
                  )
                }
              >
                <option value="_self">Same tab</option>
                <option value="_blank">New tab</option>
              </select>
            </label>
          </div>
        ))}
        <button
          type="button"
          className="rounded-xl border px-3 py-2 text-sm"
          onClick={() => setCards((list) => [...list, emptyCard()])}
        >
          Add card
        </button>
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold text-slate-500">Footer notes (optional)</p>
        {footerItems.map((item, i) => (
          <div key={i} className="mb-2 grid gap-2 md:grid-cols-3">
            <select
              className="h-10 rounded-lg border px-2 text-sm"
              value={item.icon}
              onChange={(e) =>
                setFooterItems((list) =>
                  list.map((row, idx) => (idx === i ? { ...row, icon: e.target.value } : row)),
                )
              }
            >
              {['book', 'people', 'sprout', 'cap'].map((icon) => (
                <option key={icon} value={icon}>
                  {icon}
                </option>
              ))}
            </select>
            <input
              className="h-10 rounded-lg border px-3 text-sm"
              placeholder="Title"
              value={item.title}
              onChange={(e) =>
                setFooterItems((list) =>
                  list.map((row, idx) => (idx === i ? { ...row, title: e.target.value } : row)),
                )
              }
            />
            <input
              className="h-10 rounded-lg border px-3 text-sm"
              placeholder="Caption"
              value={item.text}
              onChange={(e) =>
                setFooterItems((list) =>
                  list.map((row, idx) => (idx === i ? { ...row, text: e.target.value } : row)),
                )
              }
            />
          </div>
        ))}
        <button
          type="button"
          className="rounded-xl border px-3 py-1.5 text-sm"
          onClick={() => setFooterItems((list) => [...list, { icon: 'book', title: '', text: '' }])}
        >
          Add footer note
        </button>
      </div>
      <button
        type="submit"
        className="h-10 rounded-xl bg-[#163a6b] px-4 text-sm font-semibold text-white"
        disabled={save.isPending}
      >
        {save.isPending ? 'Saving…' : 'Save Explore section'}
      </button>
    </form>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchSchoolWebHomepage,
  patchSchoolWebHomepage,
  SCHOOL_WEB_HERO_SLIDE_MAX,
  uploadSchoolWebHeroImages,
} from '@/services/school-web';
import { apiErrorMessage } from '@/utils/api-error';

type SlideForm = {
  enabled: boolean;
  kicker: string;
  title: string;
  text: string;
  image: string;
  ctaLabel: string;
  ctaHref: string;
};

const emptySlide = (): SlideForm => ({
  enabled: true,
  kicker: '',
  title: '',
  text: '',
  image: '',
  ctaLabel: 'Apply for Admission',
  ctaHref: '/apply',
});

function slideNeedsTitle(slide: SlideForm) {
  return slide.enabled !== false && Boolean(slide.image.trim()) && slide.title.trim().length < 2;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function SchoolWebHeroCms() {
  const qc = useQueryClient();
  const home = useQuery({ queryKey: ['school-web-home'], queryFn: fetchSchoolWebHomepage });
  const bulkRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busySlot, setBusySlot] = useState<number | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [rest, setRest] = useState<Record<string, unknown>>({});
  const [slides, setSlides] = useState<SlideForm[]>([]);

  useEffect(() => {
    const section = home.data?.find((s) => s.key === 'hero');
    if (!section) return;
    const payload = asRecord(section.payload);
    const { slides: rawSlides, ...other } = payload;
    setEnabled(section.enabled);
    setRest(other);
    setSlides(
      (Array.isArray(rawSlides) ? rawSlides : []).slice(0, SCHOOL_WEB_HERO_SLIDE_MAX).map((row) => {
        const item = asRecord(row);
        return {
          enabled: item.enabled !== false,
          kicker: String(item.kicker || ''),
          title: String(item.title || ''),
          text: String(item.text || ''),
          image: String(item.image || ''),
          ctaLabel: String(item.ctaLabel || 'Apply for Admission'),
          ctaHref: String(item.ctaHref || '/apply'),
        };
      }),
    );
  }, [home.data]);

  const save = useMutation({
    mutationFn: (nextSlides: SlideForm[]) =>
      patchSchoolWebHomepage('hero', {
        enabled,
        payload: {
          ...rest,
          slides: nextSlides.map((slide) => ({
            enabled: slide.enabled,
            kicker: slide.kicker.trim() || undefined,
            title: slide.title.trim() || undefined,
            text: slide.text.trim() || undefined,
            image: slide.image.trim(),
            ctaLabel: slide.ctaLabel.trim() || undefined,
            ctaHref: slide.ctaHref.trim() || undefined,
          })),
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['school-web-home'] });
      setError(null);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const persist = (next: SlideForm[]) => {
    if (next.some(slideNeedsTitle)) {
      setSlides(next);
      setError('Each slider image needs a title before you can save.');
      return;
    }
    setSlides(next);
    save.mutate(next);
  };

  const addUrls = (urls: string[], replaceIndex?: number) => {
    setSlides((list) => {
      let next = [...list];
      if (replaceIndex != null && next[replaceIndex]) {
        next[replaceIndex] = {
          ...next[replaceIndex]!,
          image: urls[0] || next[replaceIndex]!.image,
          title: next[replaceIndex]!.title.trim() || 'Campus photograph',
        };
        urls.slice(1).forEach((url) => {
          if (next.length < SCHOOL_WEB_HERO_SLIDE_MAX)
            next.push({ ...emptySlide(), image: url, title: 'Campus photograph' });
        });
      } else {
        for (const url of urls) {
          const blank = next.findIndex((row) => !row.image);
          if (blank >= 0) {
            next[blank] = {
              ...next[blank]!,
              image: url,
              title: next[blank]!.title.trim() || 'Campus photograph',
            };
          } else if (next.length < SCHOOL_WEB_HERO_SLIDE_MAX) {
            next.push({ ...emptySlide(), image: url, title: 'Campus photograph' });
          }
        }
      }
      save.mutate(next);
      return next;
    });
  };

  const onFiles = async (files: FileList | null, replaceIndex?: number) => {
    if (!files?.length) return;
    const room =
      SCHOOL_WEB_HERO_SLIDE_MAX -
      (replaceIndex == null ? slides.filter((s) => s.image).length : slides.length - 1);
    const picked = Array.from(files).slice(
      0,
      Math.max(1, Math.min(SCHOOL_WEB_HERO_SLIDE_MAX, room || SCHOOL_WEB_HERO_SLIDE_MAX)),
    );
    if (!picked.length) {
      setError(
        `The slider already has ${SCHOOL_WEB_HERO_SLIDE_MAX} images. Remove one to add another.`,
      );
      return;
    }
    setBusySlot(replaceIndex ?? -1);
    setError(null);
    try {
      const { urls } = await uploadSchoolWebHeroImages(picked);
      addUrls(urls, replaceIndex);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusySlot(null);
      if (bulkRef.current) bulkRef.current.value = '';
    }
  };

  const move = (index: number, dir: number) => {
    const target = index + dir;
    if (target < 0 || target >= slides.length) return;
    const next = [...slides];
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row!);
    persist(next);
  };

  return (
    <form
      className="space-y-4 rounded-2xl border bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (slides.some(slideNeedsTitle)) {
          setError('Each slider image needs a title before you can save.');
          return;
        }
        save.mutate(slides);
      }}
    >
      <div>
        <h2 className="text-sm font-semibold text-[#1a365d]">Homepage slider</h2>
        <p className="text-xs text-slate-500">
          Upload campus photos for the public home page (up to {SCHOOL_WEB_HERO_SLIDE_MAX}). The
          first slide always shows the school welcome text. Later slides are shown at full
          brightness with the image title. Every photo needs a title.
        </p>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Show the slider
      </label>
      <label className="block rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm">
        <span className="font-semibold text-[#1a365d]">
          Add photos (up to {SCHOOL_WEB_HERO_SLIDE_MAX})
        </span>
        <p className="mt-1 text-xs text-slate-500">
          {slides.length} of {SCHOOL_WEB_HERO_SLIDE_MAX} slides
          {busySlot != null ? ' · Uploading…' : ''}
        </p>
        <input
          ref={bulkRef}
          className="mt-2 block w-full text-xs"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={busySlot != null || slides.length >= SCHOOL_WEB_HERO_SLIDE_MAX}
          onChange={(e) => void onFiles(e.target.files)}
        />
      </label>
      <div className="space-y-3">
        {slides.map((slide, i) => (
          <div
            key={`${slide.image}-${i}`}
            className="grid gap-3 rounded-xl border p-3 md:grid-cols-[160px_1fr]"
          >
            <div className="space-y-2">
              {slide.image ? (
                <img src={slide.image} alt="" className="h-28 w-full rounded-lg object-cover" />
              ) : (
                <div className="grid h-28 place-items-center rounded-lg bg-slate-100 text-xs text-slate-500">
                  No photo
                </div>
              )}
              <input
                className="block w-full text-xs"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busySlot != null}
                onChange={(e) => void onFiles(e.target.files, i)}
              />
            </div>
            <div className="grid gap-2">
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
                  onClick={() => persist(slides.filter((_, idx) => idx !== i))}
                >
                  Remove
                </button>
                <label className="ml-auto flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={slide.enabled}
                    onChange={(e) =>
                      setSlides((list) =>
                        list.map((row, idx) =>
                          idx === i ? { ...row, enabled: e.target.checked } : row,
                        ),
                      )
                    }
                  />
                  Visible
                </label>
              </div>
              <label className="text-xs font-semibold text-[#1a365d]">
                Image title
                <input
                  className="mt-1 h-9 w-full rounded-lg border px-3 text-sm font-normal"
                  placeholder="Required — shown on this photo"
                  value={slide.title}
                  required
                  aria-required="true"
                  onChange={(e) =>
                    setSlides((list) =>
                      list.map((row, idx) => (idx === i ? { ...row, title: e.target.value } : row)),
                    )
                  }
                />
              </label>
              {slideNeedsTitle(slide) ? (
                <p className="text-xs text-red-600">Add a title for this photo.</p>
              ) : null}
              {i === 0 ? (
                <p className="text-xs text-slate-500">
                  The first slide always shows “Welcome to St. Luke’s”. Later slides stay bright and
                  use this title as a caption.
                </p>
              ) : null}
              <input
                className="h-9 rounded-lg border px-3 text-sm"
                placeholder="Eyebrow (optional)"
                value={slide.kicker}
                onChange={(e) =>
                  setSlides((list) =>
                    list.map((row, idx) => (idx === i ? { ...row, kicker: e.target.value } : row)),
                  )
                }
              />
              <textarea
                className="h-16 rounded-lg border p-2 text-sm"
                placeholder="Short caption (optional)"
                value={slide.text}
                onChange={(e) =>
                  setSlides((list) =>
                    list.map((row, idx) => (idx === i ? { ...row, text: e.target.value } : row)),
                  )
                }
              />
              <div className="grid gap-2 md:grid-cols-2">
                <input
                  className="h-9 rounded-lg border px-3 text-sm"
                  placeholder="Button label"
                  value={slide.ctaLabel}
                  onChange={(e) =>
                    setSlides((list) =>
                      list.map((row, idx) =>
                        idx === i ? { ...row, ctaLabel: e.target.value } : row,
                      ),
                    )
                  }
                />
                <input
                  className="h-9 rounded-lg border px-3 text-sm"
                  placeholder="Button URL"
                  value={slide.ctaHref}
                  onChange={(e) =>
                    setSlides((list) =>
                      list.map((row, idx) =>
                        idx === i ? { ...row, ctaHref: e.target.value } : row,
                      ),
                    )
                  }
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-xl border px-3 py-2 text-sm"
          disabled={slides.length >= SCHOOL_WEB_HERO_SLIDE_MAX}
          onClick={() =>
            setSlides((list) =>
              list.length >= SCHOOL_WEB_HERO_SLIDE_MAX ? list : [...list, emptySlide()],
            )
          }
        >
          Add empty slide
        </button>
        <button
          type="submit"
          className="h-10 rounded-xl bg-[#163a6b] px-4 text-sm font-semibold text-white"
          disabled={save.isPending}
        >
          {save.isPending ? 'Saving…' : 'Save slider'}
        </button>
      </div>
    </form>
  );
}

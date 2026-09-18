'use client';

import Image from 'next/image';
import { useState } from 'react';

type Item = {
  id: string;
  name: string;
  designation: string;
  organisation: string;
  quote: string;
  photo: string | null;
  rating: number;
};

export function TestimonialCarousel({ items }: { items: Item[] }) {
  const [index, setIndex] = useState(0);
  if (!items.length) return null;
  const item = items[index];
  return (
    <div className="mt-8">
      <figure className="rounded-3xl border border-slate-200 bg-slate-50 p-6 md:p-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          {item.photo ? (
            <Image
              src={item.photo}
              alt={item.name}
              width={112}
              height={112}
              className="h-28 w-28 rounded-2xl object-cover object-top"
            />
          ) : null}
          <blockquote>
            <p className="text-lg text-slate-800">“{item.quote}”</p>
            <figcaption className="mt-4">
              <div className="font-semibold">{item.name}</div>
              <div className="text-sm text-slate-500">
                {item.designation}, {item.organisation}
              </div>
              <div className="mt-1 text-amber-500">{'★'.repeat(item.rating)}</div>
            </figcaption>
          </blockquote>
        </div>
      </figure>
      <div className="mt-4 flex justify-center gap-2">
        {items.map((t, i) => (
          <button
            key={t.id}
            type="button"
            aria-label={`Show testimonial ${i + 1}`}
            onClick={() => setIndex(i)}
            className={`h-2.5 w-2.5 rounded-full ${i === index ? 'bg-blue-600' : 'bg-slate-300'}`}
          />
        ))}
      </div>
    </div>
  );
}

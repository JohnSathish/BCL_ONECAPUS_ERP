'use client';

import { useId, useState } from 'react';
import {
  MORNING_PRAYERS,
  type MorningPrayerDay,
  schoolWeekdayPrayerKey,
} from '@/components/school-web/school-morning-prayers';

export function SchoolMorningPrayerCard({ initialDay }: { initialDay?: MorningPrayerDay }) {
  const tabId = useId();
  const [day, setDay] = useState<MorningPrayerDay>(initialDay || schoolWeekdayPrayerKey());
  const prayer = MORNING_PRAYERS.find((item) => item.day === day) ?? MORNING_PRAYERS[0];

  return (
    <aside className="sls-prayer-card sls-about-pri-anim" aria-labelledby={`${tabId}-heading`}>
      <div className="sls-prayer-scene" aria-hidden>
        <svg className="sls-prayer-cross" viewBox="0 0 64 88" fill="none">
          <rect x="26" y="4" width="12" height="80" rx="2" fill="#c9a227" opacity="0.9" />
          <rect x="8" y="22" width="48" height="12" rx="2" fill="#c9a227" opacity="0.9" />
        </svg>
      </div>
      <p className="sls-prayer-script">“Start your day with God and everything is possible.”</p>
      <p className="sls-kicker sls-kicker-lead">Daily Morning Prayer</p>
      <h2 id={`${tabId}-heading`}>Let Us Begin the Day with Prayer</h2>
      <p className="sls-prayer-lede">
        A new prayer each day to guide, inspire and keep us close to God.
      </p>
      <div className="sls-prayer-tabs" role="tablist" aria-label="Morning prayer by weekday">
        {MORNING_PRAYERS.map((item) => {
          const selected = item.day === day;
          return (
            <button
              key={item.day}
              type="button"
              role="tab"
              id={`${tabId}-${item.day}`}
              aria-selected={selected}
              aria-controls={`${tabId}-panel`}
              className={selected ? 'is-active' : undefined}
              onClick={() => setDay(item.day)}
            >
              <CalendarMark />
              {item.label}
            </button>
          );
        })}
      </div>
      <article
        className="sls-prayer-panel"
        id={`${tabId}-panel`}
        role="tabpanel"
        aria-labelledby={`${tabId}-${prayer.day}`}
      >
        <h3>
          <SunMark />
          {prayer.title}
        </h3>
        <p>{prayer.body}</p>
        <p className="sls-prayer-close">{prayer.close}</p>
      </article>
      <blockquote className="sls-prayer-quote">
        <p>“Prayer is the key that opens the heart to God.”</p>
        <cite>St. Teresa of Calcutta</cite>
      </blockquote>
    </aside>
  );
}

function CalendarMark() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
      <path
        fill="currentColor"
        d="M7 3h2v2h6V3h2v2h3v16H4V5h3V3zm12 8H5v9h14v-9zM8 7H6v2h2V7zm10 0h-2v2h2V7z"
      />
    </svg>
  );
}

function SunMark() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <path
        fill="currentColor"
        d="M11 4h2v3h-2V4zm0 13h2v3h-2v-3zM4 11h3v2H4v-2zm13 0h3v2h-3v-2zM6.2 6.2l2.1 2.1-1.4 1.4-2.1-2.1 1.4-1.4zm11.6 11.6-2.1-2.1 1.4-1.4 2.1 2.1-1.4 1.4zM17.8 6.2l1.4 1.4-2.1 2.1-1.4-1.4 2.1-2.1zM6.2 17.8l-1.4-1.4 2.1-2.1 1.4 1.4-2.1 2.1zM12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z"
      />
    </svg>
  );
}

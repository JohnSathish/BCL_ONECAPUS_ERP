'use client';

import { useEffect, useState } from 'react';
import { api } from '@/services/api';

type BirthdayPopupStatus = {
  isBirthday: boolean;
  shouldDisplay: boolean;
  birthdayDate: string | null;
  studentName: string;
  profilePhoto: string | null;
  message: string;
  collegeName: string;
  dismissed: boolean;
};

const FLAGS = ['#F43F5E', '#FACC15', '#38BDF8', '#22C55E', '#FB923C', '#A855F7'];
let closedBirthdayDate: string | null = null;

function initials(name: string) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '');
  return letters.join('') || 'S';
}

export function StudentBirthdayCardHost() {
  const [status, setStatus] = useState<BirthdayPopupStatus | null>(null);

  useEffect(() => {
    let active = true;
    void api
      .get<BirthdayPopupStatus>('/v1/students/me/birthday-popup')
      .then(({ data }) => {
        if (!active || !data.shouldDisplay || !data.studentName?.trim()) return;
        if (data.birthdayDate && closedBirthdayDate === data.birthdayDate) return;
        setStatus(data);
        void api.post('/v1/students/me/birthday-popup/shown').catch(() => undefined);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!status) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [status]);

  function close() {
    if (status?.birthdayDate) closedBirthdayDate = status.birthdayDate;
    setStatus(null);
    void api.post('/v1/students/me/birthday-popup/dismiss').catch(() => undefined);
  }

  if (!status) return null;

  const college = status.collegeName?.trim() || 'Don Bosco College, Tura';

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(30,27,75,0.45)] px-4 py-6"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Birthday wishes"
        className="relative w-full max-w-[380px] overflow-hidden rounded-3xl bg-white shadow-[0_18px_40px_rgba(76,29,149,0.28)]"
      >
        <div className="flex flex-col items-center bg-gradient-to-b from-[#F4EEFF] via-white to-[#FFF7FB] px-6 pb-5 pt-4">
          <div className="mb-2 flex gap-2" aria-hidden>
            {FLAGS.map((color, index) => (
              <span
                key={color}
                className="h-[18px] w-3.5 rounded-b-lg rounded-t-sm"
                style={{
                  backgroundColor: color,
                  transform: `rotate(${index % 2 ? 8 : -8}deg)`,
                }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close birthday card"
            className="absolute right-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-2xl leading-none text-slate-700"
          >
            ×
          </button>
          <div className="mt-1 flex flex-col items-center">
            <span className="z-10 -mb-2 text-3xl" aria-hidden>
              👑
            </span>
            <div className="rounded-full border-[3px] border-[#FDE68A] bg-white p-1">
              {status.profilePhoto ? (
                <img
                  src={status.profilePhoto}
                  alt=""
                  className="h-[108px] w-[108px] rounded-full object-cover"
                />
              ) : (
                <div className="flex h-[108px] w-[108px] items-center justify-center rounded-full bg-[#EEF2FF] text-2xl font-bold text-[#3730A3]">
                  {initials(status.studentName)}
                </div>
              )}
            </div>
          </div>
          <p className="mt-2.5 font-serif text-3xl italic text-[#3730A3]">Happy</p>
          <p className="-mt-1 text-4xl font-extrabold text-[#DB2777]">Birthday!</p>
          <p className="mt-1.5 text-center text-xl font-extrabold text-gray-900">
            {status.studentName}
          </p>
          <p className="mt-2 text-center text-[15px] leading-6 text-slate-700">{status.message}</p>
          <div className="mt-3.5 flex w-full items-center justify-between">
            <span className="text-4xl" aria-hidden>
              🎁
            </span>
            <div className="px-2 text-center">
              <p className="text-[13px] text-slate-600">With best wishes,</p>
              <p className="text-[15px] font-extrabold text-[#1E3A8A]">{college}</p>
            </div>
            <span className="text-4xl" aria-hidden>
              🎂
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

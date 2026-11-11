import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useSegments } from 'expo-router';
import { BirthdayPopupCard } from '@/components/student-portal/birthday-popup-card';
import { useStudentPortal } from '@/components/student-portal/student-portal-context';
import {
  currentIstDateKey,
  loadBirthdayPopup,
  rememberBirthdayPopup,
  type BirthdayPopupStatus,
} from '@/services/birthday-popup';

export function BirthdayPopupHost() {
  const { homeSettled } = useStudentPortal();
  const segments = useSegments();
  const [status, setStatus] = useState<BirthdayPopupStatus | null>(null);
  const [open, setOpen] = useState(false);
  const checking = useRef(false);
  const checkedDate = useRef<string | null>(null);
  const markedShown = useRef(false);

  const onDashboard =
    segments.includes('(tabs)') &&
    (segments[segments.length - 1] === '(tabs)' || segments[segments.length - 1] === 'index');

  const onDashboardRef = useRef(onDashboard);
  onDashboardRef.current = onDashboard;
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const check = useCallback(async () => {
    const today = currentIstDateKey();
    if (checking.current || checkedDate.current === today) return;
    checking.current = true;
    try {
      const next = await loadBirthdayPopup();
      if (!onDashboardRef.current) return;
      if (!next) {
        if (!retryTimer.current) {
          retryTimer.current = setTimeout(() => {
            retryTimer.current = null;
            void check();
          }, 8000);
        }
        return;
      }
      checkedDate.current = today;
      if (!next.shouldDisplay || !next.studentName.trim()) {
        setOpen(false);
        return;
      }
      setStatus(next);
      setOpen(true);
    } finally {
      checking.current = false;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!homeSettled || !onDashboard) return;
    void check();
  }, [check, homeSettled, onDashboard]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      if (checkedDate.current !== currentIstDateKey()) {
        checkedDate.current = null;
        markedShown.current = false;
        void check();
      }
    });
    return () => sub.remove();
  }, [check]);

  useEffect(() => {
    if (!open || !status?.birthdayDate || markedShown.current) return;
    markedShown.current = true;
    void rememberBirthdayPopup('shown', status.birthdayDate);
  }, [open, status?.birthdayDate]);

  const close = useCallback(() => {
    setOpen(false);
    if (status?.birthdayDate) void rememberBirthdayPopup('dismissed', status.birthdayDate);
  }, [status?.birthdayDate]);

  if (!open || !status) return null;

  return (
    <BirthdayPopupCard
      visible
      name={status.studentName}
      photoUrl={status.profilePhoto}
      message={status.message}
      collegeName={status.collegeName || 'Don Bosco College, Tura'}
      onClose={close}
    />
  );
}

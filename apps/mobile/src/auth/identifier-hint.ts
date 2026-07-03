import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/api/client';

export type IdentifierHint = {
  label: string;
  tone: string;
  icon: string;
};

export type LoginHintResponse = {
  recognized: boolean;
  kind?: 'student' | 'faculty' | 'staff' | 'admin';
  label?: string;
  icon?: string;
  tone?: string;
};

export function detectIdentifierHint(raw: string): IdentifierHint | null {
  const value = raw.trim();
  if (!value) return null;

  if (/^BS\d|^BA\d|^BSC|^BCOM|^BBA/i.test(value)) {
    return { label: 'Student Account', tone: '#2563eb', icon: '👨‍🎓' };
  }
  if (/^REG\d|^ENR\d|^UNI\d/i.test(value)) {
    return { label: 'Student Account', tone: '#2563eb', icon: '👨‍🎓' };
  }
  if (/^EMP\d|^DBC\d|^STF/i.test(value)) {
    return { label: 'Staff Account', tone: '#0d9488', icon: '👔' };
  }
  if (/^ABC/i.test(value)) {
    return { label: 'Student Account (ABC ID)', tone: '#2563eb', icon: '🪪' };
  }
  if (/^\d{10}$/.test(value)) {
    return { label: 'Registered Mobile', tone: '#7c3aed', icon: '📱' };
  }
  if (value.includes('@')) {
    const lower = value.toLowerCase();
    if (/principal|administrator|admin@|erp-admin/.test(lower)) {
      return { label: 'Admin Account', tone: '#be185d', icon: '🏛' };
    }
    if (/hod\.|head\.|dean\./.test(lower)) {
      return { label: 'Admin Account', tone: '#be185d', icon: '🏛' };
    }
    if (/accountant|finance|fees/.test(lower)) {
      return { label: 'Admin Account', tone: '#be185d', icon: '🏛' };
    }
    if (/library|librarian/.test(lower)) {
      return { label: 'Staff Account', tone: '#0d9488', icon: '👔' };
    }
    if (/faculty|teacher|prof\./.test(lower)) {
      return { label: 'Faculty Account', tone: '#0d9488', icon: '👩‍🏫' };
    }
    if (/staff@|\.staff\.|employee/.test(lower)) {
      return { label: 'Staff Account', tone: '#0d9488', icon: '👔' };
    }
    if (/student|\.edu|\.ac\./.test(lower)) {
      return { label: 'Student Account', tone: '#2563eb', icon: '👨‍🎓' };
    }
    return null;
  }

  return null;
}

export function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return { text: 'Good Morning', icon: '☀️' };
  if (hour < 17) return { text: 'Good Afternoon', icon: '🌤️' };
  return { text: 'Good Evening', icon: '🌙' };
}

export function getSemesterLabel(date = new Date()) {
  const month = date.getMonth() + 1;
  return month >= 7 && month <= 12 ? 'Odd Semester' : 'Even Semester';
}

export function looksLikeCapsLock(password: string) {
  if (password.length < 4) return false;
  const letters = password.replace(/[^a-zA-Z]/g, '');
  if (letters.length < 3) return false;
  return letters === letters.toUpperCase();
}

export function toIdentifierHint(response: LoginHintResponse): IdentifierHint | null {
  if (!response.recognized || !response.label) return null;
  return {
    label: response.label,
    icon: response.icon ?? '🔐',
    tone: response.tone ?? '#2563eb',
  };
}

function shouldLookupRemote(localHint: IdentifierHint | null) {
  if (!localHint) return true;
  return localHint.label === 'Registered Mobile';
}

export function useIdentifierHint(identifier: string): IdentifierHint | null {
  const localHint = useMemo(() => detectIdentifierHint(identifier), [identifier]);
  const [remoteHint, setRemoteHint] = useState<IdentifierHint | null>(null);

  useEffect(() => {
    const value = identifier.trim();
    if (value.length < 3) {
      setRemoteHint(null);
      return;
    }
    if (!shouldLookupRemote(localHint)) {
      setRemoteHint(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const query = encodeURIComponent(value);
          const data = await apiFetch<LoginHintResponse>(
            `/v1/auth/login-hint?identifier=${query}`,
            { skipAuth: true },
          );
          if (cancelled) return;
          setRemoteHint(toIdentifierHint(data));
        } catch {
          if (!cancelled) setRemoteHint(null);
        }
      })();
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [identifier, localHint]);

  return remoteHint ?? localHint;
}

'use client';

import { useMemo } from 'react';
import { useAuthStore } from '@/store/auth-store';

export function useShiftScope() {
  const session = useAuthStore((s) => s.session);
  const user = session?.user;

  return useMemo(() => {
    const allShifts = Boolean(user?.allShifts);
    const shiftIds = user?.shiftIds ?? [];
    const primaryShiftId = user?.primaryShiftId ?? shiftIds[0];
    const activeShiftId = allShifts ? undefined : primaryShiftId;

    return {
      allShifts,
      shiftIds,
      primaryShiftId,
      activeShiftId,
      isShiftAdmin: user?.roles.some((r) => r.startsWith('shift-')),
    };
  }, [user]);
}

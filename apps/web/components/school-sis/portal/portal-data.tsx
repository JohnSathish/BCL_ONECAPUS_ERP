'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchSchoolPortalHome } from '@/services/school-sis-portal';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { CHILD_STORAGE_KEY, asRecord, asText } from './portal-utils';

type PortalData = {
  home: Record<string, unknown> | null;
  childId: string | null;
  setChildId: (id: string | null) => void;
  loading: boolean;
};

const PortalDataContext = createContext<PortalData>({
  home: null,
  childId: null,
  setChildId: () => undefined,
  loading: true,
});

export function usePortalData() {
  return useContext(PortalDataContext);
}

function readChild() {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem(CHILD_STORAGE_KEY);
}

export function PortalDataProvider({ children }: { children: ReactNode }) {
  const authed = useAuthQueryEnabled();
  const [childId, setChildIdState] = useState<string | null>(readChild);
  const homeQ = useQuery({
    queryKey: ['school-sis-portal-home', childId],
    queryFn: () => fetchSchoolPortalHome(childId),
    enabled: authed,
  });

  const value = useMemo<PortalData>(
    () => ({
      home: homeQ.data ?? null,
      childId,
      setChildId: (id) => {
        setChildIdState(id);
        if (typeof window !== 'undefined') {
          if (id) window.sessionStorage.setItem(CHILD_STORAGE_KEY, id);
          else window.sessionStorage.removeItem(CHILD_STORAGE_KEY);
        }
      },
      loading: homeQ.isLoading,
    }),
    [homeQ.data, homeQ.isLoading, childId],
  );

  return <PortalDataContext.Provider value={value}>{children}</PortalDataContext.Provider>;
}

export function portalMe(home: Record<string, unknown> | null) {
  return asRecord(home?.me);
}

export function portalStudent(home: Record<string, unknown> | null) {
  return asRecord(portalMe(home).student);
}

export function portalDisplayName(home: Record<string, unknown> | null, fallback = 'Welcome') {
  return asText(portalMe(home).displayName, fallback);
}

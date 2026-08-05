import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type PrincipalDrawerContextValue = {
  open: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
};

const PrincipalDrawerContext = createContext<PrincipalDrawerContextValue | null>(null);

export function PrincipalDrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openDrawer = useCallback(() => setOpen(true), []);
  const closeDrawer = useCallback(() => setOpen(false), []);
  const toggleDrawer = useCallback(() => setOpen((v) => !v), []);
  const value = useMemo(
    () => ({ open, openDrawer, closeDrawer, toggleDrawer }),
    [open, openDrawer, closeDrawer, toggleDrawer],
  );
  return (
    <PrincipalDrawerContext.Provider value={value}>{children}</PrincipalDrawerContext.Provider>
  );
}

export function usePrincipalDrawer() {
  const ctx = useContext(PrincipalDrawerContext);
  if (!ctx) {
    throw new Error('usePrincipalDrawer must be used within PrincipalDrawerProvider');
  }
  return ctx;
}

/** Safe hook when shell may render outside provider during auth boot. */
export function usePrincipalDrawerOptional() {
  return useContext(PrincipalDrawerContext);
}

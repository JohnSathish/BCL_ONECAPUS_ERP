import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Alert } from 'react-native';

type SyncGuardContextValue = {
  isEditing: boolean;
  beginEditing: (reason?: string) => void;
  endEditing: () => void;
  /** Returns false if sync should be skipped (editing in progress). */
  requestSync: (run: () => void | Promise<void>) => boolean;
  pendingConfigNotice: boolean;
  clearPendingNotice: () => void;
};

const SyncGuardContext = createContext<SyncGuardContextValue | null>(null);

export function SyncGuardProvider({ children }: { children: ReactNode }) {
  const [editCount, setEditCount] = useState(0);
  const [pendingConfigNotice, setPendingConfigNotice] = useState(false);
  const notifiedRef = useRef(false);

  const beginEditing = useCallback((_reason?: string) => {
    setEditCount((n) => n + 1);
  }, []);

  const endEditing = useCallback(() => {
    setEditCount((n) => Math.max(0, n - 1));
  }, []);

  const requestSync = useCallback(
    (run: () => void | Promise<void>) => {
      if (editCount > 0) {
        if (!notifiedRef.current) {
          notifiedRef.current = true;
          setPendingConfigNotice(true);
          Alert.alert(
            'Updates available',
            'New updates are available. They will be applied after you finish your current task.',
          );
        }
        return false;
      }
      notifiedRef.current = false;
      setPendingConfigNotice(false);
      void run();
      return true;
    },
    [editCount],
  );

  const clearPendingNotice = useCallback(() => {
    setPendingConfigNotice(false);
    notifiedRef.current = false;
  }, []);

  const value = useMemo(
    () => ({
      isEditing: editCount > 0,
      beginEditing,
      endEditing,
      requestSync,
      pendingConfigNotice,
      clearPendingNotice,
    }),
    [editCount, beginEditing, endEditing, requestSync, pendingConfigNotice, clearPendingNotice],
  );

  return <SyncGuardContext.Provider value={value}>{children}</SyncGuardContext.Provider>;
}

export function useSyncGuard() {
  const ctx = useContext(SyncGuardContext);
  if (!ctx) {
    return {
      isEditing: false,
      beginEditing: () => undefined,
      endEditing: () => undefined,
      requestSync: (run: () => void | Promise<void>) => {
        void run();
        return true;
      },
      pendingConfigNotice: false,
      clearPendingNotice: () => undefined,
    } satisfies SyncGuardContextValue;
  }
  return ctx;
}

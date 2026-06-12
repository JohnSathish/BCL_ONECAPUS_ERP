import { useCallback, useState } from 'react';

import { cloneLayout } from './designer-utils';
import type { IdCardLayoutV1 } from '@/types/id-card-template';

const MAX_HISTORY = 50;

export function useDesignerHistory(initial: IdCardLayoutV1) {
  const [layout, setLayoutState] = useState(initial);
  const [past, setPast] = useState<IdCardLayoutV1[]>([]);
  const [future, setFuture] = useState<IdCardLayoutV1[]>([]);

  const setLayout = useCallback(
    (updater: IdCardLayoutV1 | ((prev: IdCardLayoutV1) => IdCardLayoutV1)) => {
      setLayoutState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        if (next === prev) return prev;
        setPast((p) => [...p.slice(-(MAX_HISTORY - 1)), cloneLayout(prev)]);
        setFuture([]);
        return next;
      });
    },
    [],
  );

  const replaceLayout = useCallback((next: IdCardLayoutV1) => {
    setPast([]);
    setFuture([]);
    setLayoutState(cloneLayout(next));
  }, []);

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p;
      const previous = p[p.length - 1];
      setLayoutState((current) => {
        setFuture((f) => [cloneLayout(current), ...f]);
        return cloneLayout(previous);
      });
      return p.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      setLayoutState((current) => {
        setPast((p) => [...p, cloneLayout(current)]);
        return cloneLayout(next);
      });
      return f.slice(1);
    });
  }, []);

  return {
    layout,
    setLayout,
    replaceLayout,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}

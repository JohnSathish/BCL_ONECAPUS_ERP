import { useCallback, useEffect, useState } from 'react';
import { getSchoolConfig } from '@/auth/school-config';
import type { SchoolConfig } from '@/types/school';

export function useSchoolConfig() {
  const [school, setSchool] = useState<SchoolConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setSchool(await getSchoolConfig());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { school, loading, reload };
}

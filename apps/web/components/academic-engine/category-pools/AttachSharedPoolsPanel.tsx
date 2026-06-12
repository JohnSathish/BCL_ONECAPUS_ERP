'use client';

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  fetchCategoryPools,
  fetchProgramPoolAssignments,
  upsertProgramPoolAssignments,
} from '@/services/academic-engine';
import { fetchInstitutions } from '@/services/organization';
import { POOL_CATEGORY_TABS, type PoolCategoryTab } from './pool-types';

type AttachSharedPoolsPanelProps = {
  programVersionId: string;
  enabled?: boolean;
};

export function AttachSharedPoolsPanel({
  programVersionId,
  enabled = true,
}: AttachSharedPoolsPanelProps) {
  const qc = useQueryClient();

  const institutions = useQuery({
    queryKey: ['organization', 'institutions'],
    queryFn: fetchInstitutions,
    enabled,
  });
  const institutionId = institutions.data?.[0]?.id ?? '';

  const pools = useQuery({
    queryKey: ['academic-engine', 'category-pools', institutionId],
    queryFn: () => fetchCategoryPools({ institutionId, includeInactive: false }),
    enabled: enabled && Boolean(institutionId),
  });

  const assignments = useQuery({
    queryKey: ['academic-engine', 'pool-assignments', programVersionId],
    queryFn: () => fetchProgramPoolAssignments(programVersionId),
    enabled: enabled && Boolean(programVersionId),
  });

  const assignedPoolIds = useMemo(
    () => new Set((assignments.data ?? []).filter((a) => a.active).map((a) => a.pool.id)),
    [assignments.data],
  );

  const eligiblePools = useMemo(
    () =>
      (pools.data ?? []).filter((pool) =>
        POOL_CATEGORY_TABS.includes(pool.categoryType as PoolCategoryTab),
      ),
    [pools.data],
  );

  const poolsBySemester = useMemo(() => {
    const map = new Map<number, typeof eligiblePools>();
    for (const pool of eligiblePools) {
      const list = map.get(pool.semesterNo) ?? [];
      list.push(pool);
      map.set(pool.semesterNo, list);
    }
    return [...map.entries()].sort(([a], [b]) => a - b);
  }, [eligiblePools]);

  const saveMut = useMutation({
    mutationFn: (nextAssigned: Set<string>) => {
      const payload = eligiblePools.map((pool) => ({
        semesterNo: pool.semesterNo,
        poolId: pool.id,
        active: nextAssigned.has(pool.id),
      }));
      return upsertProgramPoolAssignments(programVersionId, payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ['academic-engine', 'pool-assignments', programVersionId],
      });
      void qc.invalidateQueries({ queryKey: ['catalog', 'offerings'] });
      void qc.invalidateQueries({ queryKey: ['academic-engine', 'offerings'] });
    },
  });

  const togglePool = (poolId: string, semesterNo: number, checked: boolean) => {
    const pool = eligiblePools.find((p) => p.id === poolId);
    if (!pool || pool.semesterNo !== semesterNo) return;
    const next = new Set(assignedPoolIds);
    if (checked) next.add(poolId);
    else next.delete(poolId);
    saveMut.mutate(next);
  };

  if (!programVersionId) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attach shared pools</CardTitle>
        <CardDescription>
          Inherit MDC, AEC, SEC, VAC, and VTC courses from global pools. Major, minor, and
          internship mappings remain programme-specific below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {saveMut.isPending ? (
          <p className="text-xs text-muted-foreground">Saving pool assignments…</p>
        ) : null}
        {poolsBySemester.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No shared pools configured. Create pools under Academic Engine → Shared Category Pools.
          </p>
        ) : (
          poolsBySemester.map(([semesterNo, semesterPools]) => (
            <div key={semesterNo} className="space-y-2">
              <p className="text-sm font-medium">Semester {semesterNo}</p>
              <div className="space-y-1">
                {semesterPools?.map((pool) => (
                  <label
                    key={pool.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={assignedPoolIds.has(pool.id)}
                      disabled={saveMut.isPending}
                      onChange={(e) => togglePool(pool.id, semesterNo, e.target.checked)}
                    />
                    <span>
                      {pool.poolName}{' '}
                      <span className="text-xs text-muted-foreground">
                        ({pool.categoryType} · {pool._count?.courses ?? 0} courses)
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))
        )}
        <p className="text-xs text-muted-foreground">
          Inherited pool courses appear in registration automatically. Use programme-specific
          mappings below to add extras or exclude individual pool courses via the curriculum list.
        </p>
      </CardContent>
    </Card>
  );
}

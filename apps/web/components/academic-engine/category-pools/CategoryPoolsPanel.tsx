'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { Button } from '@/components/ui/button';
import { deleteCategoryPool, fetchCategoryPools } from '@/services/academic-engine';
import { fetchInstitutions } from '@/services/organization';
import { apiErrorMessage } from '@/utils/api-error';
import { BulkAssignPoolsDialog } from './BulkAssignPoolsDialog';
import { PoolEditorDialog } from './PoolEditorDialog';
import { POOL_CATEGORY_TABS } from './pool-types';

export function CategoryPoolsPanel() {
  const qc = useQueryClient();
  const [categoryTab, setCategoryTab] = useState<string>('MDC');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editPoolId, setEditPoolId] = useState<string | null>(null);
  const [assignPoolId, setAssignPoolId] = useState<string | null>(null);

  const institutions = useQuery({
    queryKey: ['organization', 'institutions'],
    queryFn: fetchInstitutions,
  });
  const institutionId = institutions.data?.[0]?.id ?? '';

  const pools = useQuery({
    queryKey: ['academic-engine', 'category-pools', institutionId, categoryTab],
    queryFn: () =>
      fetchCategoryPools({
        institutionId,
        categoryType: categoryTab,
        includeInactive: true,
      }),
    enabled: Boolean(institutionId),
  });

  const filteredPools = useMemo(
    () => (pools.data ?? []).filter((pool) => pool.categoryType === categoryTab),
    [pools.data, categoryTab],
  );

  const openCreate = () => {
    setEditPoolId(null);
    setEditorOpen(true);
  };

  const openEdit = (poolId: string) => {
    setEditPoolId(poolId);
    setEditorOpen(true);
  };

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['academic-engine', 'category-pools'] });
  };

  const deletePoolMut = useMutation({
    mutationFn: deleteCategoryPool,
    onSuccess: () => {
      if (editPoolId) {
        setEditorOpen(false);
        setEditPoolId(null);
      }
      refresh();
    },
    onError: (error) => {
      window.alert(apiErrorMessage(error, 'Could not delete pool'));
    },
  });

  const confirmDeletePool = (pool: {
    id: string;
    poolName: string;
    _count?: { courses?: number; assignments?: number };
  }) => {
    const courses = pool._count?.courses ?? 0;
    const assignments = pool._count?.assignments ?? 0;
    const details =
      courses > 0 || assignments > 0
        ? `\n\nThis removes ${courses} course(s) from the pool, unassigns ${assignments} programme(s), and deletes canonical pool offerings.`
        : '';
    if (confirm(`Delete "${pool.poolName}"?${details}\n\nThis cannot be undone.`)) {
      deletePoolMut.mutate(pool.id);
    }
  };

  return (
    <>
      <CompactCard className="min-w-0">
        <CompactCardHeader
          title="Shared category pools"
          description="Map MDC, AEC, SEC, VAC, and VTC courses once and assign pools to multiple programmes"
        />
        <CompactCardBody className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {POOL_CATEGORY_TABS.map((tab) => (
              <Button
                key={tab}
                size="sm"
                variant={categoryTab === tab ? 'default' : 'outline'}
                onClick={() => setCategoryTab(tab)}
              >
                {tab}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={!institutionId} onClick={openCreate}>
              Create {categoryTab} pool
            </Button>
          </div>

          {!institutionId ? (
            <p className="text-sm text-muted-foreground">No institution configured.</p>
          ) : pools.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading pools…</p>
          ) : filteredPools.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No {categoryTab} pools yet. Create one to share courses across programmes.
            </p>
          ) : (
            <div className="space-y-2">
              {filteredPools.map((pool) => (
                <div
                  key={pool.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3"
                >
                  <div>
                    <p className="font-medium">{pool.poolName}</p>
                    <p className="text-xs text-muted-foreground">
                      Semester {pool.semesterNo} · {pool._count?.courses ?? 0} course(s) ·{' '}
                      {pool._count?.assignments ?? 0} programme assignment(s)
                      {!pool.active ? ' · Inactive' : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(pool.id)}>
                      Manage
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setAssignPoolId(pool.id)}>
                      Assign to programmes
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={deletePoolMut.isPending}
                      onClick={() => confirmDeletePool(pool)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CompactCardBody>
      </CompactCard>

      <PoolEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        poolId={editPoolId}
        institutionId={institutionId}
        defaultCategory={categoryTab}
        onSaved={refresh}
      />

      {assignPoolId ? (
        <BulkAssignPoolsDialog
          open={Boolean(assignPoolId)}
          onOpenChange={(open) => {
            if (!open) setAssignPoolId(null);
          }}
          poolId={assignPoolId}
          onAssigned={refresh}
        />
      ) : null}
    </>
  );
}

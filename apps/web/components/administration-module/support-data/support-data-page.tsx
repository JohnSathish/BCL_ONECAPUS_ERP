'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { AdminPageHeader } from '@/components/administration-module/admin-page-header';
import { AdminShell, AdminGlassCard } from '@/components/administration-module/ui/admin-shell';
import { CategoryTreeNav } from '@/components/administration-module/support-data/category-tree-nav';
import { MasterDataFormDrawer } from '@/components/administration-module/support-data/master-data-form-drawer';
import { MasterDataTable } from '@/components/administration-module/support-data/master-data-table';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { useRequireAuth } from '@/hooks/use-auth';
import {
  createSupportDataRow,
  exportSupportData,
  fetchSupportDataCategories,
  fetchSupportDataRows,
  reorderSupportData,
  setSupportDataStatus,
  updateSupportDataRow,
  validateSupportDataImport,
  commitSupportDataImport,
} from '@/services/support-data';
import type { SupportDataRow } from '@/types/support-data';

export function SupportDataPage() {
  useRequireAuth();
  const { canEditLookups } = useAdminPermissions();
  const qc = useQueryClient();

  const [selectedCategory, setSelectedCategory] = useState('departments');
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [editingRow, setEditingRow] = useState<SupportDataRow | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});

  const groupsQ = useQuery({
    queryKey: ['support-data', 'categories'],
    queryFn: fetchSupportDataCategories,
  });

  const categoryMeta = useMemo(() => {
    for (const g of groupsQ.data ?? []) {
      const cat = g.categories.find((c) => c.code === selectedCategory);
      if (cat) return { group: g.label, ...cat };
    }
    return null;
  }, [groupsQ.data, selectedCategory]);

  const rowsQ = useQuery({
    queryKey: ['support-data', selectedCategory, search, showInactive],
    queryFn: () =>
      fetchSupportDataRows(selectedCategory, {
        q: search || undefined,
        activeOnly: !showInactive,
      }),
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = { ...form, label: form.label ?? form.name };
      if (drawerMode === 'create') {
        return createSupportDataRow(selectedCategory, payload);
      }
      if (!editingRow) throw new Error('No row selected');
      return updateSupportDataRow(selectedCategory, editingRow.id, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support-data', selectedCategory] });
      qc.invalidateQueries({ queryKey: ['support-data', 'categories'] });
      setDrawerOpen(false);
      setEditingRow(null);
      setForm({});
    },
  });

  const openCreate = () => {
    setDrawerMode('create');
    setEditingRow(null);
    setForm({
      sortOrder: (rowsQ.data?.length ?? 0) + 1,
      status: 'ACTIVE',
      category: selectedCategory === 'board-subjects' ? 'GENERAL' : 'TEACHING',
      boardType: selectedCategory === 'board-subjects' ? 'GENERAL' : undefined,
      departmentType: 'ACADEMIC',
    });
    setDrawerOpen(true);
  };

  const openEdit = (row: SupportDataRow) => {
    setDrawerMode('edit');
    setEditingRow(row);
    setForm({
      code: row.code,
      label: row.label,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
      status: row.metadata?.status ?? (row.isActive ? 'ACTIVE' : 'INACTIVE'),
      ...row.metadata,
    });
    setDrawerOpen(true);
  };

  const toggleStatus = async (row: SupportDataRow) => {
    await setSupportDataStatus(selectedCategory, row.id, !row.isActive);
    qc.invalidateQueries({ queryKey: ['support-data', selectedCategory] });
  };

  const moveRow = async (row: SupportDataRow, direction: -1 | 1) => {
    const rows = rowsQ.data ?? [];
    const idx = rows.findIndex((r) => r.id === row.id);
    const target = idx + direction;
    if (target < 0 || target >= rows.length) return;
    const ids = rows.map((r) => r.id);
    [ids[idx], ids[target]] = [ids[target], ids[idx]];
    await reorderSupportData(selectedCategory, ids);
    qc.invalidateQueries({ queryKey: ['support-data', selectedCategory] });
  };

  const handleExport = async () => {
    const blob = await exportSupportData(selectedCategory, search || undefined);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedCategory}-support-data.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (file: File) => {
    const result = await validateSupportDataImport(selectedCategory, file);
    if (!result.valid) {
      alert(result.errors.map((e) => `Row ${e.row}: ${e.message}`).join('\n'));
      return;
    }
    await commitSupportDataImport(selectedCategory, result.rows);
    qc.invalidateQueries({ queryKey: ['support-data', selectedCategory] });
  };

  return (
    <DashboardShell role="admin" title="Support Data">
      <AdminShell>
        <AdminPageHeader
          title="Support Data"
          subtitle="Centralized master data management — no code changes needed"
        />
        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          <AdminGlassCard className="p-3">
            <CategoryTreeNav
              groups={groupsQ.data ?? []}
              selected={selectedCategory}
              onSelect={(code) => {
                setSelectedCategory(code);
                setSearch('');
              }}
            />
          </AdminGlassCard>

          <div className="space-y-4">
            <AdminGlassCard className="flex flex-wrap items-center gap-2 p-4">
              <Input
                placeholder="Search code or label…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-xs"
              />
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                />
                Show inactive
              </label>
              <div className="ml-auto flex flex-wrap gap-2">
                {categoryMeta?.features.export ? (
                  <Button type="button" variant="outline" size="sm" onClick={handleExport}>
                    Export
                  </Button>
                ) : null}
                {canEditLookups && categoryMeta?.features.import ? (
                  <label className="inline-flex h-8 cursor-pointer items-center rounded-md border border-border bg-card px-3 text-xs font-medium transition-colors hover:bg-muted">
                    Import
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleImport(file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                ) : null}
                {canEditLookups ? (
                  <Button type="button" size="sm" onClick={openCreate}>
                    Add {categoryMeta?.label ?? 'entry'}
                  </Button>
                ) : null}
              </div>
            </AdminGlassCard>

            <AdminGlassCard className="p-0">
              <div className="border-b px-4 py-3">
                <h3 className="font-semibold">{categoryMeta?.label ?? selectedCategory}</h3>
                <p className="text-xs text-muted-foreground">
                  {categoryMeta?.group ?? ''} · {(rowsQ.data ?? []).length} entries
                </p>
              </div>
              <MasterDataTable
                rows={rowsQ.data ?? []}
                fields={categoryMeta?.fields ?? []}
                canEdit={canEditLookups}
                reorderEnabled={categoryMeta?.features.reorder}
                onEdit={openEdit}
                onToggleStatus={toggleStatus}
                onMoveUp={(row) => moveRow(row, -1)}
                onMoveDown={(row) => moveRow(row, 1)}
              />
            </AdminGlassCard>
          </div>
        </div>

        <MasterDataFormDrawer
          open={drawerOpen}
          mode={drawerMode}
          categoryLabel={categoryMeta?.label ?? selectedCategory}
          fields={categoryMeta?.fields ?? []}
          form={form}
          setForm={setForm}
          saving={saveMut.isPending}
          editingRow={editingRow}
          onClose={() => setDrawerOpen(false)}
          onSave={() => saveMut.mutate()}
        />
      </AdminShell>
    </DashboardShell>
  );
}

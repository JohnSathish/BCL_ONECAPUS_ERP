'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Eye, Plus, Power, PowerOff } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { DataTable, type DataTableColumn } from '@/components/erp/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  PopupEditor,
  emptyPopupEditorValue,
  popupToEditorValue,
  type PopupEditorValue,
} from '@/components/website-cms/popup-editor';
import { PopupPreviewOverlay } from '@/components/website-cms/popup-preview-overlay';
import { resolvePopupImageUrl } from '@/components/website-cms/popup-utils';
import {
  createWebsitePopup,
  deleteWebsitePopup,
  duplicateWebsitePopup,
  fetchWebsitePopups,
  previewWebsitePopup,
  revalidateWebsite,
  updateWebsitePopup,
  updateWebsitePopupStatus,
} from '@/services/website-cms';
import type { WebsitePopup } from '@/types/website-cms';
import { apiErrorMessage } from '@/utils/api-error';

type Props = {
  onMessage: (message: string) => void;
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function editorToPayload(value: PopupEditorValue) {
  return {
    title: value.title.trim(),
    popupType: value.popupType,
    contentHtml: value.contentHtml,
    imageJson: value.imageJson,
    videoUrl: value.videoUrl || null,
    videoType: value.videoType || null,
    buttonJson: value.buttonJson,
    status: value.status,
    displayOrder: value.displayOrder,
    showTrigger: value.showTrigger,
    showDelay: value.showDelay,
    scrollPercent: value.scrollPercent,
    frequency: value.frequency,
    closeBehavior: value.closeBehavior,
    position: value.position,
    animation: value.animation,
    overlayJson: value.overlayJson,
    sizeJson: value.sizeJson,
    startDate: value.startDate || null,
    endDate: value.endDate || null,
    startTime: value.startTime || null,
    endTime: value.endTime || null,
    page: 'HOME',
  };
}

function popupPreviewThumb(row: WebsitePopup) {
  const imageUrl = resolvePopupImageUrl(row.imageJson);
  if (row.popupType === 'IMAGE' && imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={imageUrl} alt="" className="h-10 w-16 rounded object-cover" />
    );
  }
  if (row.contentHtml) {
    const text = row.contentHtml
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return <span className="line-clamp-2 text-xs text-muted-foreground">{text.slice(0, 80)}</span>;
  }
  return <span className="text-xs text-muted-foreground">{row.popupType}</span>;
}

export function PopupsView({ onMessage }: Props) {
  const queryClient = useQueryClient();
  const rows = useQuery({ queryKey: ['website', 'popups'], queryFn: fetchWebsitePopups });
  const [mode, setMode] = useState<'list' | 'edit'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorValue, setEditorValue] = useState<PopupEditorValue>(emptyPopupEditorValue());
  const [previewPopup, setPreviewPopup] = useState<WebsitePopup | null>(null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['website', 'popups'] });
    void revalidateWebsite(['/']).catch(() => undefined);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!editorValue.title.trim()) throw new Error('Title is required');
      const payload = editorToPayload(editorValue);
      if (editingId) return updateWebsitePopup(editingId, payload);
      return createWebsitePopup(payload);
    },
    onSuccess: () => {
      onMessage(editingId ? 'Popup updated.' : 'Popup created.');
      setMode('list');
      setEditingId(null);
      setEditorValue(emptyPopupEditorValue());
      invalidate();
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not save popup')),
  });

  const remove = useMutation({
    mutationFn: deleteWebsitePopup,
    onSuccess: () => {
      onMessage('Popup deleted.');
      invalidate();
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not delete popup')),
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACTIVE' | 'INACTIVE' }) =>
      updateWebsitePopupStatus(id, status),
    onSuccess: () => {
      onMessage('Popup status updated.');
      invalidate();
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not update status')),
  });

  const duplicate = useMutation({
    mutationFn: duplicateWebsitePopup,
    onSuccess: () => {
      onMessage('Popup duplicated.');
      invalidate();
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not duplicate popup')),
  });

  const previewSaved = useMutation({
    mutationFn: previewWebsitePopup,
    onSuccess: (popup) => setPreviewPopup(popup as WebsitePopup),
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not preview popup')),
  });

  const columns = useMemo<DataTableColumn<WebsitePopup>[]>(
    () => [
      {
        key: 'preview',
        header: 'Preview',
        className: 'w-[100px]',
        cell: (row) => popupPreviewThumb(row),
      },
      { key: 'title', header: 'Title', cell: (row) => row.title },
      { key: 'type', header: 'Type', cell: (row) => row.popupType },
      {
        key: 'status',
        header: 'Status',
        cell: (row) => (
          <Badge variant={row.status === 'ACTIVE' ? 'default' : 'secondary'}>{row.status}</Badge>
        ),
      },
      { key: 'start', header: 'Start', cell: (row) => formatDate(row.startDate) },
      { key: 'end', header: 'End', cell: (row) => formatDate(row.endDate) },
      { key: 'order', header: 'Order', cell: (row) => row.displayOrder },
      { key: 'author', header: 'Created by', cell: (row) => row.createdByName || '—' },
      { key: 'created', header: 'Created', cell: (row) => formatDate(row.createdAt) },
      {
        key: 'actions',
        header: 'Actions',
        className: 'w-[280px]',
        cell: (row) => (
          <div className="flex flex-wrap gap-1">
            <Button type="button" size="sm" variant="ghost" onClick={() => setPreviewPopup(row)}>
              <Eye className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => duplicate.mutate(row.id)}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() =>
                toggleStatus.mutate({
                  id: row.id,
                  status: row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
                })
              }
            >
              {row.status === 'ACTIVE' ? (
                <PowerOff className="h-3.5 w-3.5" />
              ) : (
                <Power className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        ),
      },
    ],
    [duplicate, toggleStatus],
  );

  if (mode === 'edit') {
    return (
      <PopupEditor
        value={editorValue}
        onChange={setEditorValue}
        saving={save.isPending}
        onCancel={() => {
          setMode('list');
          setEditingId(null);
          setEditorValue(emptyPopupEditorValue());
        }}
        onSave={() => save.mutate()}
        onPreview={() => {
          if (editingId) {
            previewSaved.mutate(editingId);
            return;
          }
          setPreviewPopup({
            id: 'preview-draft',
            title: editorValue.title || 'Preview',
            popupType: editorValue.popupType,
            contentHtml: editorValue.contentHtml,
            contentJson: {},
            imageJson: editorValue.imageJson,
            videoUrl: editorValue.videoUrl,
            videoType: editorValue.videoType,
            buttonJson: editorValue.buttonJson,
            status: editorValue.status,
            displayOrder: editorValue.displayOrder,
            showTrigger: editorValue.showTrigger,
            showDelay: editorValue.showDelay,
            scrollPercent: editorValue.scrollPercent,
            frequency: editorValue.frequency,
            closeBehavior: editorValue.closeBehavior,
            position: editorValue.position,
            animation: editorValue.animation,
            overlayJson: editorValue.overlayJson,
            sizeJson: editorValue.sizeJson,
            page: 'HOME',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }}
        previewPopup={previewPopup}
        onClosePreview={() => setPreviewPopup(null)}
      />
    );
  }

  return (
    <>
      <CompactCard>
        <div className="flex items-start justify-between gap-3 border-b border-border/60 px-4 py-3">
          <CompactCardHeader
            title="Popup Management"
            description="Create and schedule home-page popups with display frequency and close rules."
            className="border-0 p-0"
          />
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setEditingId(null);
              setEditorValue(emptyPopupEditorValue());
              setMode('edit');
            }}
          >
            <Plus className="mr-1 h-4 w-4" /> Add popup
          </Button>
        </div>
        <CompactCardBody>
          {rows.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading popups…</p>
          ) : (
            <div className="space-y-3">
              <DataTable
                columns={columns}
                rows={rows.data ?? []}
                getRowKey={(row) => row.id}
                canManage
                onEdit={(row) => {
                  setEditingId(row.id);
                  setEditorValue(popupToEditorValue(row));
                  setMode('edit');
                }}
                onDelete={(row) => {
                  if (window.confirm(`Delete popup "${row.title}"?`)) remove.mutate(row.id);
                }}
                deletePending={remove.isPending}
              />
            </div>
          )}
        </CompactCardBody>
      </CompactCard>

      {previewPopup && mode === 'list' ? (
        <PopupPreviewOverlay popup={previewPopup} onClose={() => setPreviewPopup(null)} forceShow />
      ) : null}
    </>
  );
}

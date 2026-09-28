'use client';

import { useMutation } from '@tanstack/react-query';
import { Download, FileSpreadsheet, FileArchive } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  commitQuestionBankBulk,
  downloadQuestionBankTemplate,
  previewQuestionBankBulk,
} from '@/services/question-bank';
import { apiErrorMessage } from '@/utils/api-error';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (count: number) => void;
};

export function QuestionBankBulkImportDialog({ open, onOpenChange, onImported }: Props) {
  const [excel, setExcel] = useState<File | null>(null);
  const [zip, setZip] = useState<File | null>(null);
  const [preview, setPreview] = useState<Awaited<
    ReturnType<typeof previewQuestionBankBulk>
  > | null>(null);

  const reset = () => {
    setExcel(null);
    setZip(null);
    setPreview(null);
  };

  const templateMut = useMutation({
    mutationFn: async () => {
      const blob = await downloadQuestionBankTemplate();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'question-bank-template.xlsx';
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    },
  });

  const previewMut = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      if (excel) form.append('excel', excel);
      if (zip) form.append('zip', zip);
      return previewQuestionBankBulk(form);
    },
    onSuccess: setPreview,
  });

  const commitMut = useMutation({
    mutationFn: async () => {
      const rows =
        preview?.rows.filter((r) => r.status === 'VALID').map((r) => r.normalized!) ?? [];
      return commitQuestionBankBulk(rows, zip ?? undefined);
    },
    onSuccess: (result) => {
      reset();
      onOpenChange(false);
      onImported(result.imported + (result.versioned ?? 0));
    },
  });

  const error = templateMut.error ?? previewMut.error ?? commitMut.error;
  const invalidRows = preview?.rows.filter((r) => r.status === 'INVALID') ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk upload question papers</DialogTitle>
          <DialogDescription>
            Fill the Excel template, put the PDFs in one ZIP file, preview, then import the valid
            rows.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={templateMut.isPending}
            onClick={() => templateMut.mutate()}
          >
            <Download className="mr-1.5 h-4 w-4" />
            {templateMut.isPending ? 'Preparing…' : 'Download Excel template'}
          </Button>

          <label className="block space-y-1.5 text-sm">
            <span className="flex items-center gap-1.5 font-medium">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" aria-hidden /> Excel sheet *
            </span>
            <Input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => {
                setExcel(e.target.files?.[0] ?? null);
                setPreview(null);
              }}
            />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="flex items-center gap-1.5 font-medium">
              <FileArchive className="h-4 w-4 text-amber-600" aria-hidden /> ZIP of PDFs
            </span>
            <Input
              type="file"
              accept=".zip"
              onChange={(e) => {
                setZip(e.target.files?.[0] ?? null);
                setPreview(null);
              }}
            />
          </label>

          {preview ? (
            <div className="rounded-lg bg-muted/40 p-3 text-sm">
              <p>
                <span className="font-semibold text-emerald-700">
                  {preview.summary.valid} valid
                </span>
                {' · '}
                <span className={invalidRows.length ? 'font-semibold text-destructive' : ''}>
                  {preview.summary.invalid} invalid
                </span>
                {' · '}
                {preview.zipFileCount} PDFs in ZIP
              </p>
              {invalidRows.length ? (
                <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-destructive">
                  {invalidRows.slice(0, 20).map((row) => (
                    <li key={row.rowNumber}>
                      Row {row.rowNumber}: {row.errors.join(', ')}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {error ? <p className="text-sm text-destructive">{apiErrorMessage(error)}</p> : null}
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!excel || previewMut.isPending}
            onClick={() => previewMut.mutate()}
          >
            {previewMut.isPending ? 'Checking…' : 'Preview'}
          </Button>
          <Button
            type="button"
            disabled={!preview?.summary.valid || commitMut.isPending}
            onClick={() => commitMut.mutate()}
          >
            {commitMut.isPending ? 'Importing…' : `Import ${preview?.summary.valid ?? 0} papers`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

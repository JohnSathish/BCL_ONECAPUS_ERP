'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  downloadKohaReport,
  dryRunKohaImport,
  fetchKohaImportBatch,
  fetchKohaImportBatches,
  fetchKohaMappings,
  retryKohaImport,
  sampleKohaImport,
  startKohaImport,
  updateKohaMapping,
  uploadKohaCatalogue,
  type KohaCollectionMapping,
  type KohaImportBatch,
} from '@/services/library';
import { apiErrorMessage } from '@/utils/api-error';

const STEPS = ['Upload', 'Preview', 'Field map', 'Departments', 'Test import', 'Import', 'Report'];

export function KohaImportWizard() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [importName, setImportName] = useState('Koha catalogue');
  const [file, setFile] = useState<File | null>(null);
  const [approved, setApproved] = useState(false);
  const [message, setMessage] = useState('');

  const history = useQuery({
    queryKey: ['library', 'koha-import', 'batches'],
    queryFn: fetchKohaImportBatches,
    enabled,
  });
  const batch = useQuery({
    queryKey: ['library', 'koha-import', batchId],
    queryFn: () => fetchKohaImportBatch(batchId as string),
    enabled: enabled && Boolean(batchId),
    refetchInterval: (query) => (query.state.data?.status === 'IMPORTING' ? 2000 : false),
  });
  const mappings = useQuery({
    queryKey: ['library', 'koha-import', batchId, 'mappings'],
    queryFn: () => fetchKohaMappings(batchId as string),
    enabled: enabled && Boolean(batchId) && step >= 3,
  });

  const upload = useMutation({
    mutationFn: () => uploadKohaCatalogue(file as File, importName),
    onSuccess: (data) => {
      setBatchId(data.id);
      setMessage('');
      setStep(1);
      void qc.invalidateQueries({ queryKey: ['library', 'koha-import'] });
    },
    onError: (error) => setMessage(apiErrorMessage(error)),
  });
  const dryRun = useMutation({
    mutationFn: () => dryRunKohaImport(batchId as string),
    onSuccess: () => {
      setMessage('Test import finished. No library books were written.');
      void batch.refetch();
    },
    onError: (error) => setMessage(apiErrorMessage(error)),
  });
  const sample = useMutation({
    mutationFn: () => sampleKohaImport(batchId as string),
    onSuccess: (data) => {
      setMessage(`Sample imported ${data.importedBooks} titles and ${data.importedCopies} copies.`);
      void batch.refetch();
    },
    onError: (error) => setMessage(apiErrorMessage(error)),
  });
  const full = useMutation({
    mutationFn: () => startKohaImport(batchId as string),
    onSuccess: () => {
      setMessage('Full import is running. This page updates as records are saved.');
      setStep(6);
      void batch.refetch();
    },
    onError: (error) => setMessage(apiErrorMessage(error)),
  });
  const retry = useMutation({
    mutationFn: () => retryKohaImport(batchId as string),
    onSuccess: () => {
      setMessage('Resume started. Previously imported records are kept.');
      void batch.refetch();
    },
    onError: (error) => setMessage(apiErrorMessage(error)),
  });

  const current = batch.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Import Koha Library Catalogue</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload the Koha workbook, review collection codes, and import one book record per title
          with a separate record for every physical copy.
        </p>
      </div>
      <ol className="flex flex-wrap gap-2">
        {STEPS.map((label, index) => (
          <li key={label}>
            <button
              type="button"
              className={`rounded-full px-3 py-1 text-xs ${index === step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
              onClick={() => setStep(index)}
            >
              {index + 1}. {label}
            </button>
          </li>
        ))}
      </ol>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      {step === 0 ? (
        <section className="space-y-3 rounded-lg border p-4">
          <label className="block text-sm font-medium" htmlFor="koha-name">
            Import name
          </label>
          <Input
            id="koha-name"
            value={importName}
            onChange={(event) => setImportName(event.target.value)}
          />
          <label className="block text-sm font-medium" htmlFor="koha-file">
            Catalogue file
          </label>
          <Input
            id="koha-file"
            type="file"
            accept=".xlsx,.csv,.zip"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <p className="text-xs text-muted-foreground">
            Workbook, CSV, or a ZIP of those files. SQL dumps are rejected and are never run against
            the database.
          </p>
          <Button disabled={!file || upload.isPending} onClick={() => upload.mutate()}>
            {upload.isPending ? 'Reading catalogue…' : 'Upload and validate'}
          </Button>
        </section>
      ) : null}

      {step === 1 && current ? <Stats batch={current} /> : null}
      {step === 2 && current ? <FieldMap batch={current} /> : null}
      {step === 3 ? (
        <MappingTable
          items={mappings.data?.items ?? []}
          departments={mappings.data?.departments ?? []}
          onSaved={() => void mappings.refetch()}
        />
      ) : null}
      {step === 4 && current ? (
        <section className="space-y-3 rounded-lg border p-4">
          <p className="text-sm">
            The test checks the staged catalogue and does not create books. The sample writes 100
            valid titles and their copies so you can search them before the full import.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={dryRun.isPending} onClick={() => dryRun.mutate()}>
              {dryRun.isPending ? 'Testing…' : 'Run test import'}
            </Button>
            <Button
              variant="outline"
              disabled={current.status === 'STAGED' || sample.isPending}
              onClick={() => sample.mutate()}
            >
              {sample.isPending ? 'Importing sample…' : 'Import 100-title sample'}
            </Button>
          </div>
          <Stats batch={current} />
        </section>
      ) : null}
      {step === 5 && current ? (
        <section className="space-y-3 rounded-lg border p-4">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={approved}
              onChange={(event) => setApproved(event.target.checked)}
            />
            I reviewed the validation results and department mappings, and I approve this catalogue
            import.
          </label>
          <Button
            disabled={
              !approved ||
              full.isPending ||
              !['DRY_RUN', 'SAMPLE_IMPORTED', 'COMPLETED_WITH_ERRORS', 'IMPORTING'].includes(
                current.status,
              )
            }
            onClick={() => full.mutate()}
          >
            {full.isPending || current.status === 'IMPORTING'
              ? 'Import running…'
              : 'Import approved records'}
          </Button>
          <p className="text-xs text-muted-foreground">Status: {current.status}</p>
        </section>
      ) : null}
      {step === 6 && current ? (
        <section className="space-y-3">
          <Stats batch={current} />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void saveReport(current.id, 'validation')}>
              Download validation report
            </Button>
            <Button variant="outline" onClick={() => void saveReport(current.id, 'errors')}>
              Download error report
            </Button>
            <Button variant="outline" onClick={() => setStep(3)}>
              Review department mapping
            </Button>
            <Button variant="outline" disabled={retry.isPending} onClick={() => retry.mutate()}>
              Retry failed records
            </Button>
          </div>
          {current.notes.length ? (
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {current.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Import history</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Titles</th>
                <th className="px-3 py-2">Copies</th>
                <th className="px-3 py-2">Imported</th>
              </tr>
            </thead>
            <tbody>
              {(history.data?.items ?? []).map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="underline"
                      onClick={() => {
                        setBatchId(item.id);
                        setStep(
                          item.status === 'COMPLETED' || item.status === 'COMPLETED_WITH_ERRORS'
                            ? 6
                            : 1,
                        );
                      }}
                    >
                      {item.importName}
                    </button>
                  </td>
                  <td className="px-3 py-2">{item.status}</td>
                  <td className="px-3 py-2">{item.totalBibliographicRecords}</td>
                  <td className="px-3 py-2">{item.totalPhysicalCopies}</td>
                  <td className="px-3 py-2">
                    {item.importedBooks} / {item.importedCopies}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stats({ batch }: { batch: KohaImportBatch }) {
  const rows = [
    ['Bibliographic records', batch.totalBibliographicRecords],
    ['Physical copies', batch.totalPhysicalCopies],
    ['Valid titles', batch.validRecords],
    ['Invalid records', batch.invalidRecords],
    ['Duplicate candidates', batch.duplicateCandidates],
    ['Missing accession numbers', batch.missingAccessionNumbers],
    ['Missing barcodes', batch.missingBarcodes],
    ['Mapped departments', batch.mappedDepartments],
    ['Unmapped collection codes', batch.unmappedCollectionCodes],
    ['Needs review', batch.needsReview],
    ['Imported titles', batch.importedBooks],
    ['Imported copies', batch.importedCopies],
    ['Skipped records', batch.skippedRecords],
    ['Failed records', batch.failedRecords],
  ];
  return (
    <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map(([label, value]) => (
        <div key={String(label)} className="rounded-lg border px-3 py-2">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="text-lg font-semibold">{value ?? 0}</dd>
        </div>
      ))}
      {batch.status === 'IMPORTING' ? (
        <div className="rounded-lg border px-3 py-2 sm:col-span-2">
          <dt className="text-xs text-muted-foreground">Progress</dt>
          <dd className="text-lg font-semibold">
            {batch.progress ?? 0} titles processed in this run
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

function FieldMap({ batch }: { batch: KohaImportBatch }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Headers found: {batch.detectedBookHeaders.join(', ') || '—'}. Copy headers:{' '}
        {batch.detectedCopyHeaders.join(', ') || '—'}.
      </p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2">Koha source</th>
              <th className="px-3 py-2">ERP destination</th>
            </tr>
          </thead>
          <tbody>
            {batch.fieldMap.map((row) => (
              <tr key={row.source} className="border-t">
                <td className="px-3 py-2">{row.source}</td>
                <td className="px-3 py-2">{row.destination}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MappingTable({
  items,
  departments,
  onSaved,
}: {
  items: KohaCollectionMapping[];
  departments: { id: string; name: string; code: string }[];
  onSaved: () => void;
}) {
  const [drafts, setDrafts] = useState<
    Record<string, { status: KohaCollectionMapping['mappingStatus']; departmentId: string }>
  >({});
  const save = useMutation({
    mutationFn: (item: KohaCollectionMapping) => {
      const draft = drafts[item.sourceCollectionCode];
      return updateKohaMapping(item.id as string, {
        mappingStatus: draft?.status ?? item.mappingStatus,
        departmentId: draft?.departmentId || item.departmentId,
      });
    },
    onSuccess: () => onSaved(),
  });
  if (!items.length)
    return (
      <p className="text-sm text-muted-foreground">
        Upload a catalogue to review collection codes.
      </p>
    );
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-3 py-2">Collection code</th>
            <th className="px-3 py-2">Description</th>
            <th className="px-3 py-2">Copies</th>
            <th className="px-3 py-2">Department</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const draft = drafts[item.sourceCollectionCode];
            const status = draft?.status ?? item.mappingStatus;
            const departmentId = draft?.departmentId ?? item.departmentId ?? '';
            return (
              <tr key={item.sourceCollectionCode || 'blank'} className="border-t">
                <td className="px-3 py-2">{item.sourceCollectionCode || '(blank)'}</td>
                <td className="px-3 py-2">{item.sourceCollectionDescription}</td>
                <td className="px-3 py-2">{item.copyCount}</td>
                <td className="px-3 py-2">
                  <select
                    className="w-full rounded-md border bg-background px-2 py-1"
                    value={departmentId}
                    onChange={(event) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [item.sourceCollectionCode]: { status, departmentId: event.target.value },
                      }))
                    }
                  >
                    <option value="">No department</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select
                    className="rounded-md border bg-background px-2 py-1"
                    value={status}
                    onChange={(event) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [item.sourceCollectionCode]: {
                          status: event.target.value as KohaCollectionMapping['mappingStatus'],
                          departmentId,
                        },
                      }))
                    }
                  >
                    <option value="NEEDS_REVIEW">Needs review</option>
                    <option value="MAPPED">Mapped</option>
                    <option value="UNMAPPED">Unmapped</option>
                    <option value="NOT_APPLICABLE">Not applicable</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!item.id || save.isPending}
                    onClick={() => save.mutate(item)}
                  >
                    Save
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

async function saveReport(id: string, kind: 'validation' | 'errors') {
  const blob = await downloadKohaReport(id, kind);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = kind === 'errors' ? 'koha-error-report.csv' : 'koha-validation-report.csv';
  link.click();
  URL.revokeObjectURL(url);
}

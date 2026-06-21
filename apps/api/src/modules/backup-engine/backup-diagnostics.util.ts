export type FailedComponent =
  | 'DATABASE'
  | 'STORAGE'
  | 'REPOSITORY'
  | 'CLOUD'
  | 'FILES'
  | 'SETTINGS'
  | 'UNKNOWN';

export type BackupRunDiagnostic = {
  failedComponent: FailedComponent;
  failureReason: string;
  likelyCause: string;
};

export function inferFailedComponent(
  progressStep?: string | null,
  errorMessage?: string | null,
): FailedComponent {
  const step = (progressStep ?? '').toUpperCase();
  const err = (errorMessage ?? '').toLowerCase();

  if (
    step === 'DUMPING_DB' ||
    err.includes('pg_dump') ||
    err.includes('pg_restore')
  ) {
    return 'DATABASE';
  }
  if (
    step === 'ARCHIVING_FILES' ||
    err.includes('tar') ||
    err.includes('zstd') ||
    err.includes('upload_root') ||
    err.includes('storage_root')
  ) {
    return 'FILES';
  }
  if (
    step === 'UPLOADING_CLOUD' ||
    err.includes('s3') ||
    err.includes('cloud') ||
    err.includes('backblaze')
  ) {
    return 'CLOUD';
  }
  if (
    step === 'PREPARING' ||
    err.includes('eacces') ||
    err.includes('permission') ||
    err.includes('writable') ||
    err.includes('mkdir')
  ) {
    return 'REPOSITORY';
  }
  if (step === 'EXPORTING_SETTINGS') {
    return 'SETTINGS';
  }
  if (err.includes('disk') || err.includes('space') || err.includes('enospc')) {
    return 'STORAGE';
  }
  return 'UNKNOWN';
}

export function failedComponentLabel(component: FailedComponent): string {
  switch (component) {
    case 'DATABASE':
      return 'PostgreSQL dump (pg_dump)';
    case 'STORAGE':
      return 'Disk / storage space';
    case 'REPOSITORY':
      return 'Backup repository (write access)';
    case 'CLOUD':
      return 'Cloud sync upload';
    case 'FILES':
      return 'File archive (documents / uploads)';
    case 'SETTINGS':
      return 'Settings export';
    default:
      return 'Unknown component';
  }
}

export function inferLikelyCause(
  component: FailedComponent,
  errorMessage?: string | null,
): string {
  const err = (errorMessage ?? '').toLowerCase();

  switch (component) {
    case 'DATABASE':
      if (err.includes('not found') || err.includes('enoent')) {
        return 'pg_dump binary missing on server PATH — install postgresql-client or set BACKUP_PG_DUMP_PATH.';
      }
      if (
        err.includes('connection') ||
        err.includes('refused') ||
        err.includes('timeout')
      ) {
        return 'PostgreSQL connection failed — verify DATABASE_URL and that Postgres accepts connections from the API/worker container.';
      }
      return 'pg_dump failed — check DATABASE_URL credentials and PostgreSQL service status.';
    case 'REPOSITORY':
      return 'Backup repository write permission issue — verify BACKUP_ROOT exists and the process user can create directories under it.';
    case 'STORAGE':
      return 'Insufficient disk space on the backup volume — free space or expand the backup partition.';
    case 'FILES':
      return 'File archive step failed — verify UPLOAD_ROOT / STORAGE_ROOT paths exist and tar/zstd are installed.';
    case 'CLOUD':
      return 'Cloud upload failed — verify bucket credentials, region, and network egress from the VPS.';
    case 'SETTINGS':
      return 'Settings export failed during full snapshot backup.';
    default:
      return 'Review the error message and server logs around the backup start time.';
  }
}

export function diagnoseRun(run: {
  progressStep?: string | null;
  errorMessage?: string | null;
}): BackupRunDiagnostic | null {
  if (!run.errorMessage) return null;
  const failedComponent = inferFailedComponent(
    run.progressStep,
    run.errorMessage,
  );
  return {
    failedComponent,
    failureReason: run.errorMessage,
    likelyCause: inferLikelyCause(failedComponent, run.errorMessage),
  };
}

export function buildRunLogText(run: {
  id: string;
  type: string;
  scope: string;
  status: string;
  triggeredBy: string;
  startedAt?: Date | string | null;
  completedAt?: Date | string | null;
  progressStep?: string | null;
  errorMessage?: string | null;
  sizeBytes?: bigint | string | null;
  jobId?: string | null;
  artifacts?: Array<{
    kind: string;
    sizeBytes?: bigint | string;
    cloudStatus?: string;
  }>;
}): string {
  const diagnostic = diagnoseRun(run);
  const lines = [
    'NEP ERP — Backup Run Log',
    '========================',
    `Run ID:        ${run.id}`,
    `Type:          ${run.type}`,
    `Scope:         ${run.scope}`,
    `Status:        ${run.status}`,
    `Triggered by:  ${run.triggeredBy}`,
    `Job ID:        ${run.jobId ?? '—'}`,
    `Started:       ${run.startedAt ? new Date(run.startedAt).toISOString() : '—'}`,
    `Completed:     ${run.completedAt ? new Date(run.completedAt).toISOString() : '—'}`,
    `Progress step: ${run.progressStep ?? '—'}`,
    `Size:          ${run.sizeBytes?.toString() ?? '0'} bytes`,
    '',
  ];

  if (run.artifacts?.length) {
    lines.push('Artifacts:');
    for (const a of run.artifacts) {
      lines.push(
        `  - ${a.kind}: ${a.sizeBytes?.toString() ?? '0'} bytes (${a.cloudStatus ?? 'PENDING'})`,
      );
    }
    lines.push('');
  }

  if (run.errorMessage) {
    lines.push('Error');
    lines.push('-----');
    lines.push(run.errorMessage);
    lines.push('');
  }

  if (diagnostic) {
    lines.push('Diagnostics');
    lines.push('-----------');
    lines.push(
      `Failed component: ${failedComponentLabel(diagnostic.failedComponent)}`,
    );
    lines.push(`Likely cause:     ${diagnostic.likelyCause}`);
    lines.push('');
  }

  lines.push(`Generated at: ${new Date().toISOString()}`);
  return lines.join('\n');
}

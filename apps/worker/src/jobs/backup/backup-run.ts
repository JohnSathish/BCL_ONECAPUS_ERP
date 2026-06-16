import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import { mkdir, stat, writeFile } from 'fs/promises';
import { execFile } from 'child_process';
import { basename, dirname, join } from 'path';
import { promisify } from 'util';
import { pipeline } from 'stream/promises';
import { backupDb, backupPaths } from './shared';

const execFileAsync = promisify(execFile);

async function sha256File(filePath: string) {
  const hash = createHash('sha256');
  await pipeline(createReadStream(filePath), hash);
  return hash.digest('hex');
}

async function archiveInstanceFiles(outputPath: string, uploadRoot: string, storageRoot: string) {
  await mkdir(dirname(outputPath), { recursive: true });
  const tarPath = outputPath.replace(/\.zst$/, '.tar');
  const sources: Array<{ parent: string; name: string }> = [];

  for (const root of [uploadRoot, storageRoot]) {
    await mkdir(root, { recursive: true });
    try {
      const info = await stat(root);
      if (info.isDirectory()) {
        sources.push({ parent: dirname(root), name: basename(root) });
      }
    } catch {
      // skip
    }
  }

  if (!sources.length) {
    await writeFile(tarPath, '');
  } else {
    await execFileAsync('tar', [
      '-cf',
      tarPath,
      ...sources.flatMap(({ parent, name }) => ['-C', parent, name]),
    ]);
  }

  try {
    await execFileAsync('zstd', ['-f', tarPath, '-o', outputPath]);
  } catch {
    await writeFile(outputPath, '');
  }
  const { unlink } = await import('fs/promises');
  await unlink(tarPath).catch(() => undefined);
}

export async function runBackupJob(runId: string) {
  const db = backupDb();
  const paths = backupPaths();
  const run = await db.backupRun.findUnique({ where: { id: runId } });
  if (!run) throw new Error(`Run ${runId} not found`);

  await db.backupRun.update({
    where: { id: runId },
    data: { status: 'RUNNING', startedAt: new Date(), progressStep: 'PREPARING' },
  });

  const runDir = join(paths.backupRoot, runId);
  await mkdir(runDir, { recursive: true });
  let totalSize = 0n;

  try {
    await db.backupRun.update({
      where: { id: runId },
      data: { progressStep: 'DUMPING_DB' },
    });
    const dbPath = join(runDir, 'database.dump');
    if (paths.skipDump) {
      await writeFile(dbPath, '-- stub backup for dev\n');
    } else {
      await execFileAsync('pg_dump', [
        '-Fc',
        '--no-owner',
        '--no-acl',
        '-f',
        dbPath,
        paths.databaseUrl,
      ]);
    }
    const dbStat = await stat(dbPath);
    const dbChecksum = await sha256File(dbPath);
    await db.backupArtifact.create({
      data: {
        runId,
        kind: 'DATABASE',
        localPath: dbPath,
        sizeBytes: BigInt(dbStat.size),
        checksumSha256: dbChecksum,
      },
    });
    totalSize += BigInt(dbStat.size);

    const type = String(run.type);
    if (type === 'DATABASE_DOCUMENTS' || type === 'FULL_SNAPSHOT') {
      await db.backupRun.update({
        where: { id: runId },
        data: { progressStep: 'ARCHIVING_FILES' },
      });
      const filesPath = join(runDir, 'files.tar.zst');
      try {
        await archiveInstanceFiles(filesPath, paths.uploadRoot, paths.storageRoot);
      } catch {
        await writeFile(filesPath, '');
      }
      const fStat = await stat(filesPath);
      const fChecksum = await sha256File(filesPath);
      await db.backupArtifact.create({
        data: {
          runId,
          kind: 'FILES',
          localPath: filesPath,
          sizeBytes: BigInt(fStat.size),
          checksumSha256: fChecksum,
        },
      });
      totalSize += BigInt(fStat.size);
    }

    await db.backupRun.update({
      where: { id: runId },
      data: {
        status: 'SUCCESS',
        completedAt: new Date(),
        sizeBytes: totalSize,
        progressStep: 'COMPLETE',
      },
    });
    return { runId, ok: true };
  } catch (err) {
    await db.backupRun.update({
      where: { id: runId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
}

export async function runRestoreJob(input: { runId: string; mode: string; safetyRunId: string }) {
  const db = backupDb();
  const paths = backupPaths();
  const safety = await db.backupRun.findUnique({
    where: { id: input.safetyRunId },
  });
  if (!safety || safety.status !== 'SUCCESS') {
    throw new Error('Safety backup not completed');
  }

  await db.systemMaintenanceFlag.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', active: true, reason: `Restore ${input.runId}` },
    update: { active: true, reason: `Restore ${input.runId}` },
  });

  try {
    const artifacts = await db.backupArtifact.findMany({
      where: { runId: input.runId },
    });
    if (input.mode === 'DATABASE' || input.mode === 'FULL') {
      const dbArtifact = artifacts.find((a) => a.kind === 'DATABASE');
      if (dbArtifact && !paths.skipDump) {
        await execFileAsync('pg_restore', [
          '--clean',
          '--if-exists',
          '--no-owner',
          '--no-acl',
          '-d',
          paths.databaseUrl,
          String(dbArtifact.localPath),
        ]);
      }
    }
    await db.systemMaintenanceFlag.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', active: false },
      update: { active: false, reason: null },
    });
    return { ok: true };
  } catch (err) {
    await db.systemMaintenanceFlag.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', active: false },
      update: { active: false },
    });
    throw err;
  }
}

import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const defaultFile = path.join(
  process.env.USERPROFILE ?? '',
  'OneDrive',
  'Desktop',
  'Import Live 1-3-5',
  'Morning Shift',
  '5th Semester',
  '5th Sem Morning Shift Final Import02 - PENDING 11 students.xlsx',
);
const pendingFile = process.env.PENDING11_FILE ?? defaultFile;
const cwd = process.cwd();

function run(command, args, extraEnv = {}) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...extraEnv },
  });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}`);
  }
}

async function main() {
  console.log('Running Sem5 legacy exception flow...');
  console.log(`Pending file: ${pendingFile}`);

  run('npm', ['run', 'legacy:sem5:ensure-table']);
  run('npm', ['run', 'legacy:sem5:bootstrap11'], {
    PENDING11_FILE: pendingFile,
  });
  run('npm', ['run', 'legacy:sem5:import11'], {
    PENDING11_FILE: pendingFile,
    PENDING11_IMPORT_MODE: 'MERGE',
  });
  run('npm', ['run', 'legacy:sem5:seed-overrides11'], {
    PENDING11_FILE: pendingFile,
  });
  run('npm', ['run', 'legacy:sem5:verify-overrides11'], {
    PENDING11_FILE: pendingFile,
  });
  run('npm', ['run', 'legacy:sem5:fix-edu-edn']);
  run('npm', ['run', 'legacy:sem5:audit-regs11']);

  console.log('\nSem5 legacy exception flow completed successfully.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

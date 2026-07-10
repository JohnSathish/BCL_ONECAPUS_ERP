import { execSync } from 'node:child_process';

function run(command, options = {}) {
  execSync(command, {
    stdio: 'inherit',
    env: process.env,
    shell: true,
    ...options,
  });
}

function tryGenerate() {
  try {
    execSync('npx prisma generate', {
      stdio: 'pipe',
      env: process.env,
      shell: true,
    });
  } catch (error) {
    const stderr = error.stderr?.toString?.() ?? '';
    const stdout = error.stdout?.toString?.() ?? '';
    const combined = `${stderr}\n${stdout}\n${error.message ?? ''}`;
    if (
      combined.includes('EPERM') ||
      combined.includes('operation not permitted')
    ) {
      console.warn(
        '[build] prisma generate skipped: query engine file is locked. Stop the running API/worker and rerun if the schema changed.',
      );
      return;
    }
    if (stderr) process.stderr.write(stderr);
    if (stdout) process.stdout.write(stdout);
    throw error;
  }
}

tryGenerate();
run('npx nest build');

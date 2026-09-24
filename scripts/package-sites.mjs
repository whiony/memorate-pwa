import { cp, mkdtemp, mkdir, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

// Keep the Worker/asset paths intact and ship the versioned SQL at the
// archive root, where the hosting migration runner can discover it.
const output = resolve(process.argv[2] || '.sites-runtime/memorate-release.tar.gz');
await access('dist/server/index.js');
await access('dist/.openai/hosting.json');
const staging = await mkdtemp(join(tmpdir(), 'memorate-release-'));
try {
  await cp('dist', join(staging, 'dist'), { recursive: true });
  await mkdir(join(staging, '.openai'));
  await cp('dist/.openai/hosting.json', join(staging, '.openai/hosting.json'));
  await cp('dist/.openai/drizzle', join(staging, 'drizzle'), { recursive: true });
  await mkdir(dirname(output), { recursive: true });
  const result = spawnSync('tar', ['-czf', output, '-C', staging, '.openai', 'dist', 'drizzle'], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Deployment archive packaging failed.');
  console.log(output);
} finally {
  await rm(staging, { recursive: true, force: true });
}

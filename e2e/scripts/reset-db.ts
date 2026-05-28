import { execSync } from 'node:child_process';
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(__dirname, '..', '.env.e2e') });

const backend = resolve(__dirname, '..', '..', 'apps', 'backend');
const env = { ...process.env };

function run(cmd: string) {
  console.log(`> ${cmd}`);
  execSync(cmd, { cwd: backend, stdio: 'inherit', env });
}

run('pnpm exec prisma migrate reset --force');
console.log('e2e database ready.');

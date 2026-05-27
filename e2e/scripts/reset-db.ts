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

// Applies all migrations to the e2e DB (creates it if absent), then seeds.
run('pnpm exec prisma migrate deploy');
run('pnpm exec prisma db seed');
console.log('e2e database ready.');

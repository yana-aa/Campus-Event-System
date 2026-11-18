import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Creates a fresh, isolated SQLite test database (prisma/test.db) once per run.
 * The file is deleted and the schema pushed to a brand-new file, so no
 * destructive reset is ever issued and the dev database is never touched.
 */
export default function globalSetup(): void {
  const root = path.resolve(__dirname, '..', '..');
  const dbFile = path.join(root, 'prisma', 'test.db');
  for (const file of [dbFile, `${dbFile}-journal`]) {
    if (fs.existsSync(file)) fs.rmSync(file);
  }

  const prismaBin = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'prisma.cmd' : 'prisma');
  execSync(`"${prismaBin}" db push --skip-generate`, {
    cwd: root,
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: 'file:./test.db', PRISMA_HIDE_UPDATE_MESSAGE: '1' },
  });
}

import fs from 'node:fs';
import path from 'node:path';

export const logDir = path.join(process.cwd(), 'logs');
export const dataDir = path.join(process.cwd(), 'data');
export const tempDir = path.join(dataDir, 'temp');

for (const dir of [logDir, dataDir, tempDir]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

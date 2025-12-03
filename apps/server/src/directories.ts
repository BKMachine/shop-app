import fs from 'node:fs';
import path from 'node:path';

export const logDir = path.join(process.cwd(), 'logs');

export const dataDir = path.join(process.cwd(), 'data');
export const imageDir = path.join(dataDir, 'images');

export const tempDir = path.join(imageDir, 'temp');
export const toolsDir = path.join(imageDir, 'tools');
export const partsDir = path.join(imageDir, 'parts');
export const setupsDir = path.join(imageDir, 'setups');

for (const dir of [dataDir, imageDir, tempDir, toolsDir, partsDir, setupsDir]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

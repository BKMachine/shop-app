import fs from 'node:fs';
import path from 'node:path';

export const logDir = path.join(process.cwd(), 'logs');

export const dataDir = path.join(process.cwd(), 'data');
export const imageDir = path.join(dataDir, 'images');
export const documentDir = path.join(dataDir, 'documents');

export const tempDir = path.join(imageDir, 'temp');
export const toolsDir = path.join(imageDir, 'tools');
export const partsDir = path.join(imageDir, 'parts');
export const customerDir = path.join(imageDir, 'customers');
export const vendorDir = path.join(imageDir, 'vendors');
export const supplierDir = path.join(imageDir, 'suppliers');

export const partsDocumentDir = path.join(documentDir, 'parts');

for (const dir of [
  dataDir,
  imageDir,
  documentDir,
  tempDir,
  toolsDir,
  partsDir,
  partsDocumentDir,
  customerDir,
  vendorDir,
  supplierDir,
]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

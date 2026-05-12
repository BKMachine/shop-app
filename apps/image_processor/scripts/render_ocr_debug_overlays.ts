/// <reference types="node" />

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  extractTextFromImageDebug,
  renderTextFromImageDebugOverlay,
} from '../src/services/image_ocr_service.js';
import type { InputImage } from '../src/services/image_processing_types.js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(scriptDir, '..');
const dataDir = path.join(appDir, 'data');
const outputDir = path.join(dataDir, 'temp');
const supportedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);

async function listSourceImages() {
  const entries = await fs.readdir(dataDir, { withFileTypes: true });

  return entries
    .filter((entry: { isFile(): boolean }) => entry.isFile())
    .map((entry: { name: string }) => entry.name)
    .filter((name: string) => supportedExtensions.has(path.extname(name).toLowerCase()))
    .sort((left: string, right: string) => left.localeCompare(right));
}

async function loadInputImage(fileName: string): Promise<InputImage> {
  const filePath = path.join(dataDir, fileName);
  return {
    buffer: await fs.readFile(filePath),
    filename: fileName,
    mimeType: `image/${path.extname(fileName).slice(1).toLowerCase() === 'jpg' ? 'jpeg' : path.extname(fileName).slice(1).toLowerCase()}`,
  };
}

async function writeOutputs(fileName: string) {
  const input = await loadInputImage(fileName);
  const debugResult = await extractTextFromImageDebug(input);
  const overlay = await renderTextFromImageDebugOverlay(input, debugResult);
  const baseName = path.parse(fileName).name;
  const overlayPath = path.join(outputDir, `${baseName}.debug.png`);
  const jsonPath = path.join(outputDir, `${baseName}.debug.json`);
  const serializableDebugResult = JSON.parse(
    JSON.stringify(debugResult, (key, value) => (key === 'detectedLabelMask' ? undefined : value)),
  );

  await fs.writeFile(overlayPath, overlay);
  await fs.writeFile(jsonPath, `${JSON.stringify(serializableDebugResult, null, 2)}\n`, 'utf8');

  return {
    fileName,
    overlayPath,
    jsonPath,
  };
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  const sourceImages = await listSourceImages();

  if (!sourceImages.length) {
    console.log(`No source images found in ${dataDir}`);
    return;
  }

  const results = [];
  for (const fileName of sourceImages) {
    results.push(await writeOutputs(fileName));
  }

  for (const result of results) {
    console.log(`Rendered ${result.fileName}`);
    console.log(`  overlay: ${result.overlayPath}`);
    console.log(`  debug:   ${result.jsonPath}`);
  }
}

await main();

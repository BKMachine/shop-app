import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { tempDir } from '../../directories.js';
import logger from '../../logger.js';
import type { InputImage } from '../image_processing_types.js';
import {
  createProcessedImage,
  ensureDirectory,
  getExecErrorMessage,
  getImageProcessorModelCacheDir,
  getSourceExtension,
} from './shared.js';

const execFileAsync = promisify(execFile);
const serviceDir = path.dirname(fileURLToPath(import.meta.url));
const rembgVenvPythonPath = path.resolve(serviceDir, '../../../.venv-rembg/bin/python');
const rembgModelCacheDir = getImageProcessorModelCacheDir('rembg');
const rembgScriptPath = path.resolve(serviceDir, '../../../scripts/remove_background_rembg.py');

function getRembgPythonBin() {
  const configured = process.env.REMBG_PYTHON_BIN?.trim();
  if (configured) return configured;
  if (fs.existsSync(rembgVenvPythonPath)) return rembgVenvPythonPath;
  return 'python3';
}

function getRembgModel() {
  return process.env.REMBG_MODEL?.trim() || 'isnet-general-use';
}

function getRembgTimeoutMs() {
  const raw = Number(process.env.REMBG_TIMEOUT_MS ?? 300000);
  return Number.isFinite(raw) && raw > 0 ? raw : 300000;
}

export async function removeImageBackgroundWithRembg(input: InputImage) {
  ensureDirectory(rembgModelCacheDir);
  fs.mkdirSync(tempDir, { recursive: true });

  const jobId = randomUUID();
  const inputPath = path.join(tempDir, `${jobId}${getSourceExtension(input)}`);
  const outputPath = path.join(tempDir, `${jobId}.png`);
  const args = [
    rembgScriptPath,
    '--input',
    inputPath,
    '--output',
    outputPath,
    '--model',
    getRembgModel(),
  ];

  fs.writeFileSync(inputPath, input.buffer);

  try {
    const { stdout, stderr } = await execFileAsync(getRembgPythonBin(), args, {
      env: {
        ...process.env,
        CUDA_VISIBLE_DEVICES: '',
        TMPDIR: os.tmpdir(),
        U2NET_HOME: rembgModelCacheDir,
      },
      timeout: getRembgTimeoutMs(),
    });

    if (stdout.trim()) logger.info(`rembg stdout: ${stdout.trim()}`);
    if (stderr.trim()) logger.warn(`rembg stderr: ${stderr.trim()}`);

    if (!fs.existsSync(outputPath)) {
      throw new Error('rembg finished without writing an output image.');
    }

    return createProcessedImage(fs.readFileSync(outputPath));
  } catch (error) {
    const message = getExecErrorMessage(error);
    throw new Error(
      `rembg failed. ${message} Install the Python deps with "pnpm --dir apps/image_processor run install:rembg".`,
    );
  } finally {
    for (const filePath of [inputPath, outputPath]) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  }
}

export function getRembgDiagnostics() {
  return {
    rembgPythonBin: getRembgPythonBin(),
    rembgModel: getRembgModel(),
    rembgModelCacheDir,
  };
}

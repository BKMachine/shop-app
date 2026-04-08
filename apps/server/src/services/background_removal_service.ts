import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { removeBackground } from '@imgly/background-removal-node';
import { imageDir, tempDir } from '../directories.js';
import logger from '../logger.js';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const backgroundRemovalEntryPath = require.resolve('@imgly/background-removal-node');
const backgroundRemovalDistDir = path.dirname(backgroundRemovalEntryPath);
const backgroundRemovalPublicPath = pathToFileURL(`${backgroundRemovalDistDir}${path.sep}`).href;
const serviceDir = path.dirname(fileURLToPath(import.meta.url));
const rembgVenvPythonPath = path.resolve(serviceDir, '../../.venv-rembg/bin/python');
const rembgModelCacheDir = path.resolve(serviceDir, '../../.rembg-models');
const rembgScriptPath = path.resolve(serviceDir, '../../scripts/remove_background_rembg.py');

export type BackgroundRemovalBackend = 'imgly' | 'rembg';
export type BackgroundRemovalModel = 'small' | 'medium' | 'large';

type RemoveImageBackgroundOptions = {
  backend?: BackgroundRemovalBackend | null;
  model?: BackgroundRemovalModel | null;
};

function isBackgroundRemovalModel(
  value: string | undefined | null,
): value is BackgroundRemovalModel {
  return value === 'small' || value === 'medium' || value === 'large';
}

function isBackgroundRemovalBackend(
  value: string | undefined | null,
): value is BackgroundRemovalBackend {
  return value === 'imgly' || value === 'rembg';
}

function getAvailableBackgroundRemovalModels(): BackgroundRemovalModel[] {
  const manifestPath = path.join(backgroundRemovalDistDir, 'resources.json');

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
    const availableModels: BackgroundRemovalModel[] = [];

    if (manifest['/models/small']) availableModels.push('small');
    if (manifest['/models/medium']) availableModels.push('medium');
    if (manifest['/models/large']) availableModels.push('large');

    if (availableModels.length) return availableModels;
  } catch {
    // Fall back to the library default preference when the manifest cannot be read.
  }

  return ['small', 'medium'];
}

const availableBackgroundRemovalModels = getAvailableBackgroundRemovalModels();

function resolveBackgroundRemovalBackend(
  requestedBackend?: BackgroundRemovalBackend | null,
): BackgroundRemovalBackend {
  const requested = requestedBackend?.trim();
  const preferredFromEnv = process.env.BACKGROUND_REMOVAL_BACKEND?.trim();

  for (const candidate of [requested, preferredFromEnv, 'imgly']) {
    if (isBackgroundRemovalBackend(candidate)) return candidate;
  }

  return 'imgly';
}

function resolveBackgroundRemovalModel(
  requestedModel?: BackgroundRemovalModel | null,
): BackgroundRemovalModel {
  const requested = requestedModel?.trim();
  const preferredFromEnv = process.env.IMGLY_BACKGROUND_REMOVAL_MODEL?.trim();

  for (const candidate of [requested, preferredFromEnv, 'large', 'medium', 'small']) {
    if (
      isBackgroundRemovalModel(candidate) &&
      availableBackgroundRemovalModels.includes(candidate)
    ) {
      return candidate;
    }
  }

  return 'medium';
}

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

function getMimeTypeForSource(sourcePath: string): string {
  const ext = path.extname(sourcePath).toLowerCase();

  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';

  return 'application/octet-stream';
}

function createProcessedTempImageFile(resultBuffer: Buffer) {
  const filename = `${randomUUID()}.png`;
  const outputPath = path.join(tempDir, filename);

  fs.writeFileSync(outputPath, resultBuffer);

  return {
    filename,
    mimeType: 'image/png',
    relPath: path.relative(imageDir, outputPath).replace(/\\/g, '/'),
  };
}

async function removeImageBackgroundWithImgly(
  sourcePath: string,
  requestedModel?: BackgroundRemovalModel | null,
) {
  const backgroundRemovalModel = resolveBackgroundRemovalModel(requestedModel);
  const sourceBuffer = fs.readFileSync(sourcePath);
  const sourceBlob = new Blob([sourceBuffer], { type: getMimeTypeForSource(sourcePath) });
  const resultBlob = await removeBackground(sourceBlob, {
    debug: false,
    model: backgroundRemovalModel,
    output: {
      format: 'image/png',
      quality: 1,
    },
    publicPath: backgroundRemovalPublicPath,
  });

  const resultBuffer = Buffer.from(await resultBlob.arrayBuffer());
  return createProcessedTempImageFile(resultBuffer);
}

async function removeImageBackgroundWithRembg(sourcePath: string) {
  fs.mkdirSync(rembgModelCacheDir, { recursive: true });

  const filename = `${randomUUID()}.png`;
  const outputPath = path.join(tempDir, filename);
  const args = [
    rembgScriptPath,
    '--input',
    sourcePath,
    '--output',
    outputPath,
    '--model',
    getRembgModel(),
  ];

  try {
    const { stdout, stderr } = await execFileAsync(getRembgPythonBin(), args, {
      env: {
        ...process.env,
        CUDA_VISIBLE_DEVICES: '',
        U2NET_HOME: rembgModelCacheDir,
      },
      timeout: getRembgTimeoutMs(),
    });

    if (stdout.trim()) logger.info(`rembg stdout: ${stdout.trim()}`);
    if (stderr.trim()) logger.warn(`rembg stderr: ${stderr.trim()}`);
  } catch (error) {
    const message = getExecErrorMessage(error);
    throw new Error(
      `rembg failed. ${message} Install the Python deps with "pnpm --dir apps/server run install:rembg".`,
    );
  }

  if (!fs.existsSync(outputPath)) {
    throw new Error('rembg finished without writing an output image.');
  }

  return {
    filename,
    mimeType: 'image/png',
    relPath: path.relative(imageDir, outputPath).replace(/\\/g, '/'),
  };
}

function getExecErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error) {
    const stderr =
      'stderr' in error ? String((error as { stderr?: unknown }).stderr ?? '').trim() : '';
    if (stderr) return stderr;

    const stdout =
      'stdout' in error ? String((error as { stdout?: unknown }).stdout ?? '').trim() : '';
    if (stdout) return stdout;
  }

  if (error instanceof Error && error.message) return error.message;
  return 'Unknown background removal failure';
}

export async function removeImageBackground(
  sourcePath: string,
  options: RemoveImageBackgroundOptions = {},
): Promise<{
  filename: string;
  mimeType: string;
  relPath: string;
}> {
  const backend = resolveBackgroundRemovalBackend(options.backend);
  const requestedModel = options.model;

  logger.info(`Removing background using ${backend} for image: ${sourcePath}`);

  try {
    if (backend === 'rembg') {
      return await removeImageBackgroundWithRembg(sourcePath);
    }

    return await removeImageBackgroundWithImgly(sourcePath, requestedModel);
  } catch (error) {
    logger.error('Background removal failed', {
      sourcePath,
      sourceMimeType: getMimeTypeForSource(sourcePath),
      backend,
      requestedModel,
      backgroundRemovalPublicPath,
      availableBackgroundRemovalModels,
      rembgPythonBin: getRembgPythonBin(),
      rembgModel: getRembgModel(),
      rembgModelCacheDir,
      error,
    });
    throw error;
  }
}

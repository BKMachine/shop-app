import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  BackgroundRemovalBackend,
  BackgroundRemovalModel,
  InputImage,
  ProcessedImage,
} from '../image_processing_types.js';

export type RemoveImageBackgroundOptions = {
  backend?: BackgroundRemovalBackend | null;
  model?: BackgroundRemovalModel | null;
};

export type BackgroundRemovalProvider = {
  removeBackground(
    input: InputImage,
    options?: RemoveImageBackgroundOptions,
  ): Promise<ProcessedImage>;
};

const backgroundRemovalDir = path.dirname(fileURLToPath(import.meta.url));

export function getImageProcessorModelsRootDir() {
  return path.resolve(
    process.env.IMAGE_PROCESSOR_MODELS_DIR?.trim() ||
      path.join(backgroundRemovalDir, '../../../models'),
  );
}

export function getImageProcessorModelCacheDir(cacheName: string) {
  const normalizedCacheName = cacheName.trim();
  if (!normalizedCacheName) {
    throw new Error('cacheName is required');
  }

  return path.join(getImageProcessorModelsRootDir(), normalizedCacheName);
}

export function ensureDirectory(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function isBackgroundRemovalModel(
  value: string | undefined | null,
): value is BackgroundRemovalModel {
  return value === 'small' || value === 'medium' || value === 'large';
}

export function isBackgroundRemovalBackend(
  value: string | undefined | null,
): value is BackgroundRemovalBackend {
  return value === 'birefnet' || value === 'imgly' || value === 'rembg';
}

export function getMimeTypeForSource(input: InputImage): string {
  const normalizedMimeType = input.mimeType?.trim().toLowerCase();
  if (normalizedMimeType) return normalizedMimeType;

  const ext = path.extname(input.filename ?? '').toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';

  return 'application/octet-stream';
}

export function getSourceExtension(input: InputImage): string {
  const ext = path.extname(input.filename ?? '').toLowerCase();
  if (ext) return ext;

  const mimeType = getMimeTypeForSource(input);
  if (mimeType === 'image/jpeg') return '.jpg';
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';

  return '.bin';
}

export function createProcessedImage(buffer: Buffer): ProcessedImage {
  return {
    buffer,
    mimeType: 'image/png',
    extension: '.png',
  };
}

export function getExecErrorMessage(error: unknown): string {
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

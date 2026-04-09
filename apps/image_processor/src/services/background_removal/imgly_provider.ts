import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { removeBackground } from '@imgly/background-removal-node';
import type { BackgroundRemovalModel, InputImage } from '../image_processing_types.js';
import { createProcessedImage, getMimeTypeForSource, isBackgroundRemovalModel } from './shared.js';

const require = createRequire(import.meta.url);
const backgroundRemovalEntryPath = require.resolve('@imgly/background-removal-node');
const backgroundRemovalDistDir = path.dirname(backgroundRemovalEntryPath);
const backgroundRemovalPublicPath = pathToFileURL(`${backgroundRemovalDistDir}${path.sep}`).href;

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

export async function removeImageBackgroundWithImgly(
  input: InputImage,
  requestedModel?: BackgroundRemovalModel | null,
) {
  const backgroundRemovalModel = resolveBackgroundRemovalModel(requestedModel);
  const sourceBlob = new Blob([Uint8Array.from(input.buffer)], {
    type: getMimeTypeForSource(input),
  });
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
  return createProcessedImage(resultBuffer);
}

export function getImglyDiagnostics(requestedModel?: BackgroundRemovalModel | null) {
  return {
    requestedModel: requestedModel ?? null,
    resolvedModel: resolveBackgroundRemovalModel(requestedModel),
    backgroundRemovalPublicPath,
    availableBackgroundRemovalModels,
  };
}

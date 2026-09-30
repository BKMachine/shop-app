import logger from '../logger.js';
import {
  type BackgroundRemovalProvider,
  getBiRefNetDiagnostics,
  getMimeTypeForSource,
  getRembgDiagnostics,
  isBackgroundRemovalBackend,
  type RemoveImageBackgroundOptions,
  removeImageBackgroundWithBiRefNet,
  removeImageBackgroundWithRembg,
} from './background_removal/index.js';
import type {
  BackgroundRemovalBackend,
  InputImage,
  ProcessedImage,
} from './image_processing_types.js';

function resolveBackgroundRemovalBackend(
  requestedBackend?: BackgroundRemovalBackend | null,
): BackgroundRemovalBackend {
  const requested = requestedBackend?.trim();
  const preferredFromEnv = process.env.BACKGROUND_REMOVAL_BACKEND?.trim();

  for (const candidate of [requested, preferredFromEnv]) {
    if (isBackgroundRemovalBackend(candidate)) return candidate;
  }

  return 'rembg';
}

const backgroundRemovalProviders: Record<BackgroundRemovalBackend, BackgroundRemovalProvider> = {
  birefnet: {
    removeBackground: async (input) => removeImageBackgroundWithBiRefNet(input),
  },
  rembg: {
    removeBackground: async (input) => removeImageBackgroundWithRembg(input),
  },
};

function getBackgroundRemovalDiagnostics(backend: BackgroundRemovalBackend) {
  if (backend === 'birefnet') return getBiRefNetDiagnostics();
  return getRembgDiagnostics();
}

export async function removeImageBackground(
  input: InputImage,
  options: RemoveImageBackgroundOptions = {},
): Promise<ProcessedImage> {
  const backend = resolveBackgroundRemovalBackend(options.backend);
  const provider = backgroundRemovalProviders[backend];

  logger.info(`Removing background using ${backend} for image: ${input.filename ?? 'upload'}`);

  try {
    // Providers are resolved here so more background removal models can be added without touching the route layer.
    return await provider.removeBackground(input);
  } catch (error) {
    logger.error('Background removal failed', {
      sourceFilename: input.filename ?? null,
      sourceMimeType: getMimeTypeForSource(input),
      backend,
      ...getBackgroundRemovalDiagnostics(backend),
      error,
    });
    throw error;
  }
}

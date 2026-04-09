import logger from '../logger.js';
import {
  type BackgroundRemovalProvider,
  getBiRefNetDiagnostics,
  getImglyDiagnostics,
  getMimeTypeForSource,
  getRembgDiagnostics,
  isBackgroundRemovalBackend,
  type RemoveImageBackgroundOptions,
  removeImageBackgroundWithBiRefNet,
  removeImageBackgroundWithImgly,
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

  for (const candidate of [requested, preferredFromEnv, 'imgly']) {
    if (isBackgroundRemovalBackend(candidate)) return candidate;
  }

  return 'imgly';
}

const backgroundRemovalProviders: Record<BackgroundRemovalBackend, BackgroundRemovalProvider> = {
  birefnet: {
    removeBackground: async (input) => removeImageBackgroundWithBiRefNet(input),
  },
  imgly: {
    removeBackground: async (input, options) =>
      removeImageBackgroundWithImgly(input, options?.model),
  },
  rembg: {
    removeBackground: async (input) => removeImageBackgroundWithRembg(input),
  },
};

function getBackgroundRemovalDiagnostics(
  backend: BackgroundRemovalBackend,
  options: RemoveImageBackgroundOptions,
) {
  if (backend === 'birefnet') return getBiRefNetDiagnostics();
  if (backend === 'imgly') return getImglyDiagnostics(options.model);
  return getRembgDiagnostics();
}

export async function removeImageBackground(
  input: InputImage,
  options: RemoveImageBackgroundOptions = {},
): Promise<ProcessedImage> {
  const backend = resolveBackgroundRemovalBackend(options.backend);
  const requestedModel = options.model;
  const provider = backgroundRemovalProviders[backend];

  logger.info(`Removing background using ${backend} for image: ${input.filename ?? 'upload'}`);

  try {
    // Providers are resolved here so more background removal models can be added without touching the route layer.
    return await provider.removeBackground(input, options);
  } catch (error) {
    logger.error('Background removal failed', {
      sourceFilename: input.filename ?? null,
      sourceMimeType: getMimeTypeForSource(input),
      backend,
      requestedModel: requestedModel ?? null,
      ...getBackgroundRemovalDiagnostics(backend, options),
      error,
    });
    throw error;
  }
}

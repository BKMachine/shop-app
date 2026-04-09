import { AutoModel, AutoProcessor, RawImage } from '@huggingface/transformers';
import sharp from 'sharp';
import type { InputImage } from '../image_processing_types.js';
import { createProcessedImage, ensureDirectory, getImageProcessorModelCacheDir } from './shared.js';

const BIREFNET_MODEL_ID = 'onnx-community/BiRefNet-ONNX';
const biRefNetCacheDir = getImageProcessorModelCacheDir('birefnet');

let biRefNetModelPromise: Promise<Awaited<ReturnType<typeof AutoModel.from_pretrained>>> | null =
  null;
let biRefNetProcessorPromise: Promise<
  Awaited<ReturnType<typeof AutoProcessor.from_pretrained>>
> | null = null;

type TensorLike = {
  data: Uint8Array | Uint8ClampedArray | number[];
  dims: number[];
  sigmoid(): {
    mul(value: number): {
      to(dtype: string): TensorLike;
    };
  };
  squeeze(dim?: number | null): TensorLike;
  unsqueeze(dim: number): TensorLike;
};

type BiRefNetMaskSettings = {
  maxDimension: number;
  dilation: number;
  blur: number;
  clampBlack: number;
  clampWhite: number;
  alphaSharpenSigma: number;
};

function getBiRefNetDtype(): 'fp16' | 'fp32' {
  return process.env.BIREFNET_DTYPE?.trim() === 'fp16' ? 'fp16' : 'fp32';
}

function getBiRefNetMaxDimension() {
  const raw = Number(process.env.BIREFNET_MAX_DIMENSION ?? 1024);
  return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : 1024;
}

function getPositiveNumberEnvValue(name: string, fallback: number) {
  const raw = Number(process.env[name] ?? fallback);
  return Number.isFinite(raw) && raw >= 0 ? raw : fallback;
}

function getBiRefNetMaskSettings(): BiRefNetMaskSettings {
  const clampBlack = Math.max(
    0,
    Math.min(254, Math.round(getPositiveNumberEnvValue('BIREFNET_MASK_CLAMP_BLACK', 12))),
  );
  const clampWhite = Math.max(
    clampBlack + 1,
    Math.min(255, Math.round(getPositiveNumberEnvValue('BIREFNET_MASK_CLAMP_WHITE', 244))),
  );

  return {
    maxDimension: getBiRefNetMaxDimension(),
    dilation: Math.max(0, Math.round(getPositiveNumberEnvValue('BIREFNET_MASK_DILATION', 1))),
    blur: getPositiveNumberEnvValue('BIREFNET_MASK_BLUR', 0.8),
    clampBlack,
    clampWhite,
    alphaSharpenSigma: getPositiveNumberEnvValue('BIREFNET_ALPHA_SHARPEN_SIGMA', 1),
  };
}

async function getBiRefNetModel() {
  if (!biRefNetModelPromise) {
    ensureDirectory(biRefNetCacheDir);
    biRefNetModelPromise = AutoModel.from_pretrained(BIREFNET_MODEL_ID, {
      cache_dir: biRefNetCacheDir,
      dtype: getBiRefNetDtype(),
    });
  }

  return biRefNetModelPromise;
}

async function getBiRefNetProcessor() {
  if (!biRefNetProcessorPromise) {
    ensureDirectory(biRefNetCacheDir);
    biRefNetProcessorPromise = AutoProcessor.from_pretrained(BIREFNET_MODEL_ID, {
      cache_dir: biRefNetCacheDir,
    });
  }

  return biRefNetProcessorPromise;
}

function getBiRefNetPixelValues(processed: unknown): unknown {
  if (typeof processed !== 'object' || !processed) {
    throw new Error('BiRefNet preprocessing did not return model inputs.');
  }

  if ('pixel_values' in processed && (processed as { pixel_values?: unknown }).pixel_values) {
    return (processed as { pixel_values: unknown }).pixel_values;
  }

  if ('input_image' in processed && (processed as { input_image?: unknown }).input_image) {
    return (processed as { input_image: unknown }).input_image;
  }

  throw new Error('BiRefNet preprocessing did not return pixel values.');
}

function isTensorLike(value: unknown): value is TensorLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    'sigmoid' in value &&
    typeof (value as { sigmoid?: unknown }).sigmoid === 'function'
  );
}

function getBiRefNetOutputTensor(output: unknown): TensorLike {
  if (typeof output !== 'object' || !output) {
    throw new Error('BiRefNet did not return a usable mask output.');
  }

  const outputImage = (output as { output_image?: unknown }).output_image;
  if (Array.isArray(outputImage) && isTensorLike(outputImage[0])) {
    return outputImage[0];
  }
  if (isTensorLike(outputImage)) {
    return outputImage;
  }

  const logits = (output as { logits?: unknown }).logits;
  if (Array.isArray(logits) && isTensorLike(logits[0])) {
    return logits[0];
  }
  if (isTensorLike(logits)) {
    return logits;
  }

  throw new Error('BiRefNet did not return an output mask.');
}

function normalizeBiRefNetMaskTensor(tensor: TensorLike) {
  let normalizedTensor = tensor;

  if (normalizedTensor.dims.length === 4) {
    if (normalizedTensor.dims[0] !== 1) {
      throw new Error(
        `BiRefNet returned an unexpected batch size for the mask tensor: ${normalizedTensor.dims.join('x')}`,
      );
    }

    normalizedTensor = normalizedTensor.squeeze(0);
  }

  if (normalizedTensor.dims.length === 2) {
    normalizedTensor = normalizedTensor.unsqueeze(0);
  }

  if (normalizedTensor.dims.length !== 3) {
    throw new Error(
      `BiRefNet returned an unsupported mask tensor shape: ${normalizedTensor.dims.join('x')}`,
    );
  }

  return normalizedTensor;
}

function getRawBufferFromTensorData(data: TensorLike['data']) {
  if (data instanceof Uint8Array || data instanceof Uint8ClampedArray) {
    return Buffer.from(data);
  }

  return Buffer.from(Uint8Array.from(data));
}

async function getMaskBufferFromTensor(tensor: TensorLike) {
  if (tensor.dims.length !== 3) {
    throw new Error(
      `BiRefNet mask conversion expected a 3D tensor, received ${tensor.dims.join('x')}`,
    );
  }

  const [dim0, dim1, dim2] = tensor.dims;
  const rawBuffer = getRawBufferFromTensorData(tensor.data);

  if (dim0 === 1) {
    return sharp(rawBuffer, {
      raw: {
        width: dim2 ?? 0,
        height: dim1 ?? 0,
        channels: 1,
      },
    })
      .png()
      .toBuffer();
  }

  if (dim2 === 1) {
    return sharp(rawBuffer, {
      raw: {
        width: dim1 ?? 0,
        height: dim0 ?? 0,
        channels: 1,
      },
    })
      .png()
      .toBuffer();
  }

  throw new Error(
    `BiRefNet returned an unsupported single-channel tensor layout: ${tensor.dims.join('x')}`,
  );
}

async function clampMaskExtremes(
  maskBuffer: Buffer,
  width: number,
  height: number,
  settings: BiRefNetMaskSettings,
) {
  const { data, info } = await sharp(maskBuffer)
    .removeAlpha()
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.channels !== 1) {
    throw new Error('BiRefNet mask post-processing expected a single-channel mask.');
  }

  const clamped = Buffer.allocUnsafe(data.length);
  for (let index = 0; index < data.length; index += 1) {
    const value = data[index] ?? 0;
    if (value <= settings.clampBlack) {
      clamped[index] = 0;
      continue;
    }
    if (value >= settings.clampWhite) {
      clamped[index] = 255;
      continue;
    }

    clamped[index] = value;
  }

  return sharp(clamped, {
    raw: {
      width,
      height,
      channels: 1,
    },
  })
    .png()
    .toBuffer();
}

async function dilateMask(maskBuffer: Buffer, width: number, height: number, radius: number) {
  if (radius <= 0) return maskBuffer;

  const { data, info } = await sharp(maskBuffer)
    .removeAlpha()
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.channels !== 1) {
    throw new Error('BiRefNet mask dilation expected a single-channel mask.');
  }

  let current = Uint8Array.from(data);

  for (let iteration = 0; iteration < radius; iteration += 1) {
    const next = new Uint8Array(current.length);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let maxValue = 0;

        for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
          const sampleY = y + offsetY;
          if (sampleY < 0 || sampleY >= height) continue;

          for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
            const sampleX = x + offsetX;
            if (sampleX < 0 || sampleX >= width) continue;

            const sampleIndex = sampleY * width + sampleX;
            const sampleValue = current[sampleIndex] ?? 0;
            if (sampleValue > maxValue) maxValue = sampleValue;
          }
        }

        next[y * width + x] = maxValue;
      }
    }

    current = next;
  }

  return sharp(Buffer.from(current), {
    raw: {
      width,
      height,
      channels: 1,
    },
  })
    .png()
    .toBuffer();
}

async function refineBiRefNetMask(
  maskBuffer: Buffer,
  width: number,
  height: number,
  settings: BiRefNetMaskSettings,
) {
  let refinedMaskBuffer = await sharp(maskBuffer)
    .resize(width, height, { fit: 'fill' })
    .removeAlpha()
    .greyscale()
    .png()
    .toBuffer();

  if (settings.dilation > 0) {
    refinedMaskBuffer = await dilateMask(refinedMaskBuffer, width, height, settings.dilation);
  }

  if (settings.blur > 0) {
    refinedMaskBuffer = await sharp(refinedMaskBuffer).blur(settings.blur).png().toBuffer();
  }

  refinedMaskBuffer = await clampMaskExtremes(refinedMaskBuffer, width, height, settings);

  if (settings.alphaSharpenSigma > 0) {
    refinedMaskBuffer = await sharp(refinedMaskBuffer)
      .sharpen(settings.alphaSharpenSigma)
      .png()
      .toBuffer();
  }

  return refinedMaskBuffer;
}

export async function removeImageBackgroundWithBiRefNet(input: InputImage) {
  const normalizedInputBuffer = await sharp(input.buffer).rotate().toBuffer();
  const normalizedMetadata = await sharp(normalizedInputBuffer).metadata();

  if (!normalizedMetadata.width || !normalizedMetadata.height) {
    throw new Error('Unable to determine image dimensions for BiRefNet input.');
  }

  const originalWidth = normalizedMetadata.width;
  const originalHeight = normalizedMetadata.height;
  const settings = getBiRefNetMaskSettings();
  const inferenceInputBuffer = await sharp(normalizedInputBuffer)
    .resize({
      width: settings.maxDimension,
      height: settings.maxDimension,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .png()
    .toBuffer();

  const [model, processor] = await Promise.all([getBiRefNetModel(), getBiRefNetProcessor()]);
  const image = await RawImage.read(
    new Blob([Uint8Array.from(inferenceInputBuffer)], { type: 'image/png' }),
  );
  const processed = await processor(image);
  const modelOutput = await model({
    input_image: getBiRefNetPixelValues(processed),
  });

  const outputTensor = getBiRefNetOutputTensor(modelOutput);
  const normalizedOutputTensor = normalizeBiRefNetMaskTensor(
    outputTensor.sigmoid().mul(255).to('uint8'),
  );
  const maskBuffer = await getMaskBufferFromTensor(normalizedOutputTensor);
  const resizedMaskBuffer = await refineBiRefNetMask(
    maskBuffer,
    originalWidth,
    originalHeight,
    settings,
  );
  const rgbBuffer = await sharp(normalizedInputBuffer).removeAlpha().png().toBuffer();

  return createProcessedImage(
    await sharp(rgbBuffer).joinChannel(resizedMaskBuffer).png().toBuffer(),
  );
}

export function getBiRefNetDiagnostics() {
  const settings = getBiRefNetMaskSettings();

  return {
    biRefNetModelId: BIREFNET_MODEL_ID,
    biRefNetCacheDir,
    biRefNetDtype: getBiRefNetDtype(),
    biRefNetMaxDimension: settings.maxDimension,
    biRefNetMaskDilation: settings.dilation,
    biRefNetMaskBlur: settings.blur,
    biRefNetMaskClampBlack: settings.clampBlack,
    biRefNetMaskClampWhite: settings.clampWhite,
    biRefNetAlphaSharpenSigma: settings.alphaSharpenSigma,
  };
}

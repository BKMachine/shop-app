import { randomUUID } from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
import { imageDir, tempDir } from '../directories.js';

const ALPHA_THRESHOLD = 8;
const SUBJECT_FILL_RATIO = 0.9;

type CropBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type CropPlan = {
  extract: CropBounds;
  extend: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
};

function findOpaqueBounds(
  data: Uint8Array,
  width: number,
  height: number,
  channels: number,
): CropBounds | null {
  if (channels < 4) return null;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * channels + 3] ?? 0;
      if (alpha <= ALPHA_THRESHOLD) continue;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) return null;

  return {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function planCrop(bounds: CropBounds, imageWidth: number, imageHeight: number): CropPlan {
  const targetWidth = Math.min(imageWidth, Math.ceil(bounds.width / SUBJECT_FILL_RATIO));
  const targetHeight = Math.min(imageHeight, Math.ceil(bounds.height / SUBJECT_FILL_RATIO));

  const finalWidth = Math.ceil(bounds.width / SUBJECT_FILL_RATIO);
  const finalHeight = Math.ceil(bounds.height / SUBJECT_FILL_RATIO);

  const centerX = bounds.left + bounds.width / 2;
  const centerY = bounds.top + bounds.height / 2;

  let left = Math.round(centerX - targetWidth / 2);
  let top = Math.round(centerY - targetHeight / 2);

  left = Math.max(0, Math.min(left, imageWidth - targetWidth));
  top = Math.max(0, Math.min(top, imageHeight - targetHeight));

  const extract = {
    left,
    top,
    width: targetWidth,
    height: targetHeight,
  };

  const missingWidth = Math.max(0, finalWidth - extract.width);
  const missingHeight = Math.max(0, finalHeight - extract.height);

  const extendLeft = Math.floor(missingWidth / 2);
  const extendRight = missingWidth - extendLeft;
  const extendTop = Math.floor(missingHeight / 2);
  const extendBottom = missingHeight - extendTop;

  return {
    extract,
    extend: {
      top: extendTop,
      bottom: extendBottom,
      left: extendLeft,
      right: extendRight,
    },
  };
}

export async function autoCropImage(sourcePath: string): Promise<{
  filename: string;
  mimeType: string;
  relPath: string;
}> {
  const image = sharp(sourcePath, { failOn: 'none' }).rotate().ensureAlpha();
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error('Unable to determine image dimensions for auto crop');
  }

  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const bounds = findOpaqueBounds(data, info.width, info.height, info.channels);

  if (!bounds) {
    throw new Error('No visible subject found to auto crop');
  }

  const cropPlan = planCrop(bounds, info.width, info.height);
  const filename = `${randomUUID()}.png`;
  const outputPath = path.join(tempDir, filename);

  let pipeline = sharp(sourcePath, { failOn: 'none' })
    .rotate()
    .ensureAlpha()
    .extract(cropPlan.extract);

  if (
    cropPlan.extend.top ||
    cropPlan.extend.bottom ||
    cropPlan.extend.left ||
    cropPlan.extend.right
  ) {
    pipeline = pipeline.extend({
      ...cropPlan.extend,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
  }

  await pipeline.png().toFile(outputPath);

  return {
    filename,
    mimeType: 'image/png',
    relPath: path.relative(imageDir, outputPath).replace(/\\/g, '/'),
  };
}

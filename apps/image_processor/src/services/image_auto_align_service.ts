import sharp from 'sharp';
import type { InputImage, ProcessedImage } from './image_processing_types.js';

const ALPHA_THRESHOLD = 8;
const BACKGROUND_DISTANCE_THRESHOLD = 28;
const MIN_FOREGROUND_PIXELS = 250;
const MIN_AXIS_RATIO = 1.25;
const MIN_ROTATION_DEGREES = 1;

type RgbColor = {
  r: number;
  g: number;
  b: number;
};

function getPixelOffset(x: number, y: number, width: number, channels: number) {
  return (y * width + x) * channels;
}

function averageColors(colors: RgbColor[]) {
  const total = colors.reduce(
    (acc, color) => {
      acc.r += color.r;
      acc.g += color.g;
      acc.b += color.b;
      return acc;
    },
    { r: 0, g: 0, b: 0 },
  );

  return {
    r: total.r / colors.length,
    g: total.g / colors.length,
    b: total.b / colors.length,
  };
}

function sampleCornerAverage(
  data: Uint8Array,
  width: number,
  height: number,
  channels: number,
  startX: number,
  startY: number,
  sampleSize: number,
) {
  const colors: RgbColor[] = [];

  for (let y = startY; y < Math.min(startY + sampleSize, height); y++) {
    for (let x = startX; x < Math.min(startX + sampleSize, width); x++) {
      const offset = getPixelOffset(x, y, width, channels);
      const alpha = data[offset + 3] ?? 255;
      if (alpha <= ALPHA_THRESHOLD) {
        continue;
      }

      colors.push({
        r: data[offset] ?? 0,
        g: data[offset + 1] ?? 0,
        b: data[offset + 2] ?? 0,
      });
    }
  }

  if (!colors.length) {
    return { r: 255, g: 255, b: 255 };
  }

  return averageColors(colors);
}

function estimateBackgroundColor(
  data: Uint8Array,
  width: number,
  height: number,
  channels: number,
) {
  const sampleSize = Math.max(4, Math.min(16, Math.floor(Math.min(width, height) * 0.08)));

  const corners = [
    sampleCornerAverage(data, width, height, channels, 0, 0, sampleSize),
    sampleCornerAverage(
      data,
      width,
      height,
      channels,
      Math.max(0, width - sampleSize),
      0,
      sampleSize,
    ),
    sampleCornerAverage(
      data,
      width,
      height,
      channels,
      0,
      Math.max(0, height - sampleSize),
      sampleSize,
    ),
    sampleCornerAverage(
      data,
      width,
      height,
      channels,
      Math.max(0, width - sampleSize),
      Math.max(0, height - sampleSize),
      sampleSize,
    ),
  ];

  return averageColors(corners);
}

function isForegroundPixel(data: Uint8Array, offset: number, backgroundColor: RgbColor) {
  const alpha = data[offset + 3] ?? 255;
  if (alpha <= ALPHA_THRESHOLD) {
    return false;
  }

  if (alpha < 250) {
    return true;
  }

  const redDiff = (data[offset] ?? 0) - backgroundColor.r;
  const greenDiff = (data[offset + 1] ?? 0) - backgroundColor.g;
  const blueDiff = (data[offset + 2] ?? 0) - backgroundColor.b;
  const distance = Math.sqrt(redDiff * redDiff + greenDiff * greenDiff + blueDiff * blueDiff);

  return distance >= BACKGROUND_DISTANCE_THRESHOLD;
}

function estimateRotationDegrees(
  data: Uint8Array,
  width: number,
  height: number,
  channels: number,
) {
  if (channels < 4) {
    throw new Error('Auto align requires RGBA image data');
  }

  const backgroundColor = estimateBackgroundColor(data, width, height, channels);

  let count = 0;
  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumYY = 0;
  let sumXY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = getPixelOffset(x, y, width, channels);
      if (!isForegroundPixel(data, offset, backgroundColor)) {
        continue;
      }

      count += 1;
      sumX += x;
      sumY += y;
      sumXX += x * x;
      sumYY += y * y;
      sumXY += x * y;
    }
  }

  if (count < MIN_FOREGROUND_PIXELS) {
    throw new Error('Not enough visible subject pixels found for auto align');
  }

  const meanX = sumX / count;
  const meanY = sumY / count;
  const covarianceXX = sumXX / count - meanX * meanX;
  const covarianceYY = sumYY / count - meanY * meanY;
  const covarianceXY = sumXY / count - meanX * meanY;

  const trace = covarianceXX + covarianceYY;
  const determinantTerm = Math.sqrt(
    (covarianceXX - covarianceYY) * (covarianceXX - covarianceYY) + 4 * covarianceXY * covarianceXY,
  );
  const majorAxis = (trace + determinantTerm) / 2;
  const minorAxis = (trace - determinantTerm) / 2;

  if (!Number.isFinite(majorAxis) || !Number.isFinite(minorAxis) || minorAxis <= 0) {
    throw new Error('Unable to determine subject orientation for auto align');
  }

  const axisRatio = majorAxis / minorAxis;
  if (axisRatio < MIN_AXIS_RATIO) {
    throw new Error('Subject is not directional enough for reliable auto align');
  }

  const angleRadians = 0.5 * Math.atan2(2 * covarianceXY, covarianceXX - covarianceYY);
  const angleDegrees = (angleRadians * 180) / Math.PI;

  if (Math.abs(angleDegrees) < MIN_ROTATION_DEGREES) {
    throw new Error('Image is already aligned closely enough');
  }

  return angleDegrees;
}

export async function autoAlignImage(input: InputImage): Promise<ProcessedImage> {
  const normalizedImage = sharp(input.buffer, { failOn: 'none' }).rotate().ensureAlpha();
  const { data, info } = await normalizedImage.raw().toBuffer({ resolveWithObject: true });

  const angleDegrees = estimateRotationDegrees(data, info.width, info.height, info.channels);
  const buffer = await sharp(input.buffer, { failOn: 'none' })
    .rotate()
    .ensureAlpha()
    .rotate(-angleDegrees, {
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  return {
    buffer,
    mimeType: 'image/png',
    extension: '.png',
  };
}

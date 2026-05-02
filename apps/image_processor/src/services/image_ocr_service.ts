import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { tempDir } from '../directories.js';
import { getExecErrorMessage } from './background_removal/shared.js';
import type { InputImage } from './image_processing_types.js';

const OCR_BACKEND = process.env.OCR_BACKEND?.trim().toLowerCase() || 'paddleocr';
const PADDLE_OCR_MODEL_ID = process.env.PADDLE_OCR_MODEL_ID?.trim() || 'PP-OCRv5_server_rec';
const execFileAsync = promisify(execFile);
const serviceDir = path.dirname(fileURLToPath(import.meta.url));
const paddleOcrScriptPath = path.resolve(serviceDir, '../../scripts/run_paddle_ocr.py');

export type CropBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type ComponentDetection = {
  bounds: CropBounds;
  score: number;
  area: number;
  mask?: Uint8Array;
  maskWidth?: number;
  maskHeight?: number;
};

type LabelDetection = {
  bounds: CropBounds;
  mask: Buffer;
  width: number;
  height: number;
};

const LABEL_DETECTION_MAX_DIMENSION = 384;
const LABEL_BRIGHTNESS_THRESHOLD = 205;
const LABEL_CHROMA_THRESHOLD = 45;
const LABEL_MIN_PIXEL_RATIO = 0.02;
const LABEL_MIN_BBOX_RATIO = 0.035;
const LABEL_MAX_BBOX_RATIO = 0.9;
const HANDWRITING_DETECTION_MAX_DIMENSION = 512;
const HANDWRITING_BRIGHTNESS_THRESHOLD = 120;
const HANDWRITING_CHROMA_THRESHOLD = 90;
const HANDWRITING_COMPONENT_MIN_AREA = 8;
const HANDWRITING_COMPONENT_MAX_BBOX_RATIO = 0.035;

export type OcrResult = {
  text: string;
  confidence: number;
};

export type OcrDebugResult = {
  modelId: string;
  detectedLabelRegion: CropBounds | null;
  detectedLabelMask: Buffer | null;
  detectedHandwritingRegion: CropBounds | null;
  detectedHandwritingLineRegions: CropBounds[];
  selectedSource: 'paddleocr';
  selectedRegion: CropBounds | null;
  selectedResult: OcrResult;
  labelRegionResult: OcrResult | null;
  handwritingRegionResult: OcrResult | null;
  fullImageResult: OcrResult;
};

function normalizeOcrText(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function shouldTryPaddleOcr() {
  return OCR_BACKEND !== 'off' && OCR_BACKEND !== 'disabled';
}

function getDefaultPaddleOcrVenvDir() {
  return path.resolve(serviceDir, '../../.venv-ocr');
}

function getPaddleOcrVenvPythonPath() {
  const venvDir = process.env.OCR_VENV_DIR?.trim() || getDefaultPaddleOcrVenvDir();
  return path.join(venvDir, 'bin/python');
}

function getPaddleOcrPythonBin() {
  const configured = process.env.OCR_PYTHON_BIN?.trim();
  if (configured) return configured;
  const venvPythonPath = getPaddleOcrVenvPythonPath();
  if (fs.existsSync(venvPythonPath)) return venvPythonPath;
  return 'python3';
}

function getOcrTimeoutMs() {
  const raw = Number(process.env.OCR_TIMEOUT_MS ?? 300000);
  return Number.isFinite(raw) && raw > 0 ? raw : 300000;
}

function getLabelMaskPixel(data: Uint8Array, offset: number) {
  const red = data[offset] ?? 0;
  const green = data[offset + 1] ?? 0;
  const blue = data[offset + 2] ?? 0;
  const brightness = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);

  return brightness >= LABEL_BRIGHTNESS_THRESHOLD && chroma <= LABEL_CHROMA_THRESHOLD;
}

function getHandwritingMaskPixel(data: Uint8Array, offset: number) {
  const red = data[offset] ?? 0;
  const green = data[offset + 1] ?? 0;
  const blue = data[offset + 2] ?? 0;
  const brightness = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);

  return brightness <= HANDWRITING_BRIGHTNESS_THRESHOLD && chroma <= HANDWRITING_CHROMA_THRESHOLD;
}

function getMarkerInkMaskPixel(data: Uint8Array, offset: number) {
  const red = data[offset] ?? 0;
  const green = data[offset + 1] ?? 0;
  const blue = data[offset + 2] ?? 0;
  const brightness = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);

  return brightness <= 95 && chroma <= 75;
}

function expandBounds(
  bounds: CropBounds,
  maxWidth: number,
  maxHeight: number,
  paddingRatio = 0.04,
  minimumPadding = 6,
) {
  const horizontalPadding = Math.max(minimumPadding, Math.round(bounds.width * paddingRatio));
  const verticalPadding = Math.max(minimumPadding, Math.round(bounds.height * paddingRatio));
  const left = Math.max(0, bounds.left - horizontalPadding);
  const top = Math.max(0, bounds.top - verticalPadding);
  const right = Math.min(maxWidth, bounds.left + bounds.width + horizontalPadding);
  const bottom = Math.min(maxHeight, bounds.top + bounds.height + verticalPadding);

  return {
    left,
    top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}

function scaleBounds(
  bounds: CropBounds,
  scaleX: number,
  scaleY: number,
  maxWidth: number,
  maxHeight: number,
): CropBounds {
  const left = Math.max(0, Math.floor(bounds.left * scaleX));
  const top = Math.max(0, Math.floor(bounds.top * scaleY));
  const right = Math.min(maxWidth, Math.ceil((bounds.left + bounds.width) * scaleX));
  const bottom = Math.min(maxHeight, Math.ceil((bounds.top + bounds.height) * scaleY));

  return {
    left,
    top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}

function unionBounds(boundsList: CropBounds[]): CropBounds {
  const left = Math.min(...boundsList.map((bounds) => bounds.left));
  const top = Math.min(...boundsList.map((bounds) => bounds.top));
  const right = Math.max(...boundsList.map((bounds) => bounds.left + bounds.width));
  const bottom = Math.max(...boundsList.map((bounds) => bounds.top + bounds.height));

  return {
    left,
    top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}

function boundsOverlapOrNear(
  left: CropBounds,
  right: CropBounds,
  horizontalGap: number,
  verticalGap: number,
) {
  const leftRight = left.left + left.width;
  const rightRight = right.left + right.width;
  const leftBottom = left.top + left.height;
  const rightBottom = right.top + right.height;

  const horizontalDistance = Math.max(
    0,
    Math.max(left.left, right.left) - Math.min(leftRight, rightRight),
  );
  const verticalDistance = Math.max(
    0,
    Math.max(left.top, right.top) - Math.min(leftBottom, rightBottom),
  );

  return horizontalDistance <= horizontalGap && verticalDistance <= verticalGap;
}

function pointInBounds(x: number, y: number, bounds: CropBounds | null) {
  return (
    Boolean(bounds) &&
    x >= (bounds?.left ?? 0) &&
    x < (bounds?.left ?? 0) + (bounds?.width ?? 0) &&
    y >= (bounds?.top ?? 0) &&
    y < (bounds?.top ?? 0) + (bounds?.height ?? 0)
  );
}

function scaleBoundsDown(
  bounds: CropBounds,
  scaleX: number,
  scaleY: number,
  maxWidth: number,
  maxHeight: number,
): CropBounds {
  const left = Math.max(0, Math.floor(bounds.left / scaleX));
  const top = Math.max(0, Math.floor(bounds.top / scaleY));
  const right = Math.min(maxWidth, Math.ceil((bounds.left + bounds.width) / scaleX));
  const bottom = Math.min(maxHeight, Math.ceil((bounds.top + bounds.height) / scaleY));

  return {
    left,
    top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}

function findLikelyLabelRegion(
  data: Uint8Array,
  width: number,
  height: number,
  channels: number,
): ComponentDetection | null {
  const totalPixels = width * height;
  const minPixels = Math.max(64, Math.round(totalPixels * LABEL_MIN_PIXEL_RATIO));
  const minBoundingPixels = Math.round(totalPixels * LABEL_MIN_BBOX_RATIO);
  const maxBoundingPixels = Math.round(totalPixels * LABEL_MAX_BBOX_RATIO);
  const visited = new Uint8Array(totalPixels);
  let bestComponent: ComponentDetection | null = null;
  let bestScore = -Infinity;

  for (let startIndex = 0; startIndex < totalPixels; startIndex += 1) {
    if (visited[startIndex]) continue;
    visited[startIndex] = 1;

    const offset = startIndex * channels;
    if (!getLabelMaskPixel(data, offset)) continue;

    const queue = [startIndex];
    let queueIndex = 0;
    let area = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    const componentMask = new Uint8Array(totalPixels);

    while (queueIndex < queue.length) {
      const index = queue[queueIndex++] ?? 0;
      const x = index % width;
      const y = Math.floor(index / width);

      area += 1;
      componentMask[index] = 1;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;

      const neighbors = [index - 1, index + 1, index - width, index + width];
      for (const neighbor of neighbors) {
        if (neighbor < 0 || neighbor >= totalPixels || visited[neighbor]) continue;

        const neighborX = neighbor % width;
        const neighborY = Math.floor(neighbor / width);
        if (Math.abs(neighborX - x) + Math.abs(neighborY - y) !== 1) continue;

        visited[neighbor] = 1;
        if (getLabelMaskPixel(data, neighbor * channels)) {
          queue.push(neighbor);
        }
      }
    }

    if (area < minPixels) continue;

    const bounds = {
      left: minX,
      top: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
    const bboxArea = bounds.width * bounds.height;
    if (bboxArea < minBoundingPixels || bboxArea > maxBoundingPixels) continue;

    const fillRatio = area / bboxArea;
    if (fillRatio < 0.45) continue;

    const aspectRatio = bounds.width / bounds.height;
    if (aspectRatio < 0.5 || aspectRatio > 3.5) continue;

    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    const normalizedCenterDistance =
      Math.hypot(centerX - width / 2, centerY - height / 2) / Math.hypot(width / 2, height / 2);
    const score = bboxArea / totalPixels + fillRatio * 1.5 - normalizedCenterDistance * 0.35;

    if (score > bestScore) {
      bestScore = score;
      bestComponent = {
        bounds,
        score,
        area,
        mask: componentMask,
        maskWidth: width,
        maskHeight: height,
      };
    }
  }

  return bestComponent;
}

function findLikelyHandwritingRegion(
  data: Uint8Array,
  width: number,
  height: number,
  channels: number,
  excludedBounds: CropBounds | null,
): CropBounds | null {
  const totalPixels = width * height;
  const visited = new Uint8Array(totalPixels);
  const candidates: ComponentDetection[] = [];
  const excludedRight = excludedBounds ? excludedBounds.left + excludedBounds.width : 0;

  for (let startIndex = 0; startIndex < totalPixels; startIndex += 1) {
    if (visited[startIndex]) continue;
    visited[startIndex] = 1;

    const startX = startIndex % width;
    const startY = Math.floor(startIndex / width);
    if (pointInBounds(startX, startY, excludedBounds)) {
      continue;
    }

    const offset = startIndex * channels;
    if (!getHandwritingMaskPixel(data, offset)) continue;

    const queue = [startIndex];
    let queueIndex = 0;
    let area = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    while (queueIndex < queue.length) {
      const index = queue[queueIndex++] ?? 0;
      const x = index % width;
      const y = Math.floor(index / width);

      area += 1;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;

      const neighbors = [index - 1, index + 1, index - width, index + width];
      for (const neighbor of neighbors) {
        if (neighbor < 0 || neighbor >= totalPixels || visited[neighbor]) continue;

        const neighborX = neighbor % width;
        const neighborY = Math.floor(neighbor / width);
        if (Math.abs(neighborX - x) + Math.abs(neighborY - y) !== 1) continue;

        visited[neighbor] = 1;
        if (pointInBounds(neighborX, neighborY, excludedBounds)) {
          continue;
        }

        if (getHandwritingMaskPixel(data, neighbor * channels)) {
          queue.push(neighbor);
        }
      }
    }

    if (area < HANDWRITING_COMPONENT_MIN_AREA) continue;

    const bounds = {
      left: minX,
      top: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
    const bboxArea = bounds.width * bounds.height;
    const bboxRatio = bboxArea / totalPixels;
    if (bboxRatio > HANDWRITING_COMPONENT_MAX_BBOX_RATIO) continue;

    const fillRatio = area / bboxArea;
    if (fillRatio < 0.025 || fillRatio > 0.7) continue;

    const aspectRatio = bounds.width / Math.max(bounds.height, 1);
    if (aspectRatio > 18) continue;

    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    const isRightOfLabel = excludedBounds
      ? centerX > excludedRight - Math.max(6, width * 0.025)
      : centerX > width * 0.35;
    const topHalfBias = centerY < height * 0.65 ? 1 : 0.25;
    const labelSideBias = isRightOfLabel ? 1 : 0.2;
    const score = (area + bounds.width * 0.8 + bounds.height * 0.35) * topHalfBias * labelSideBias;
    candidates.push({ bounds, score, area });
  }

  if (!candidates.length) return null;

  candidates.sort((left, right) => right.score - left.score);
  const seed = candidates[0];
  if (!seed) return null;
  const grouped: ComponentDetection[] = [seed];
  let mergedBounds = seed.bounds;
  const horizontalGap = Math.max(16, Math.round(width * 0.09));
  const verticalGap = Math.max(10, Math.round(height * 0.06));

  let added = true;
  while (added) {
    added = false;
    for (const candidate of candidates) {
      if (grouped.includes(candidate)) continue;
      if (!boundsOverlapOrNear(mergedBounds, candidate.bounds, horizontalGap, verticalGap)) {
        continue;
      }

      const candidateCenterX = candidate.bounds.left + candidate.bounds.width / 2;
      const candidateCenterY = candidate.bounds.top + candidate.bounds.height / 2;
      const mergedCenterY = mergedBounds.top + mergedBounds.height / 2;
      if (Math.abs(candidateCenterY - mergedCenterY) > height * 0.22) continue;
      if (excludedBounds && candidateCenterX < excludedRight - width * 0.04) continue;

      grouped.push(candidate);
      mergedBounds = unionBounds(grouped.map((group) => group.bounds));
      added = true;
    }
  }

  return mergedBounds;
}

function findLikelyHandwritingLines(
  data: Uint8Array,
  width: number,
  height: number,
  channels: number,
): CropBounds[] {
  const totalPixels = width * height;
  const visited = new Uint8Array(totalPixels);
  const components: ComponentDetection[] = [];

  for (let startIndex = 0; startIndex < totalPixels; startIndex += 1) {
    if (visited[startIndex]) continue;
    visited[startIndex] = 1;
    if (!getMarkerInkMaskPixel(data, startIndex * channels)) continue;

    const queue = [startIndex];
    let queueIndex = 0;
    let area = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    while (queueIndex < queue.length) {
      const index = queue[queueIndex++] ?? 0;
      const x = index % width;
      const y = Math.floor(index / width);

      area += 1;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;

      const neighbors = [index - 1, index + 1, index - width, index + width];
      for (const neighbor of neighbors) {
        if (neighbor < 0 || neighbor >= totalPixels || visited[neighbor]) continue;

        const neighborX = neighbor % width;
        const neighborY = Math.floor(neighbor / width);
        if (Math.abs(neighborX - x) + Math.abs(neighborY - y) !== 1) continue;

        visited[neighbor] = 1;
        if (getMarkerInkMaskPixel(data, neighbor * channels)) {
          queue.push(neighbor);
        }
      }
    }

    if (area < 24) continue;

    const bounds = {
      left: minX,
      top: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
    if (bounds.width > width * 0.28 || bounds.height > height * 0.24) continue;
    if (area / (bounds.width * bounds.height) < 0.08) continue;

    components.push({ bounds, score: area, area });
  }

  const minimumLineArea = Math.max(180, width * height * 0.001);
  const lineVerticalGap = Math.max(12, Math.round(height * 0.08));
  const lines: ComponentDetection[][] = [];
  for (const component of components.sort(
    (left, right) =>
      left.bounds.top + left.bounds.height / 2 - (right.bounds.top + right.bounds.height / 2),
  )) {
    const centerY = component.bounds.top + component.bounds.height / 2;
    const line = lines.find((candidateLine) => {
      const candidateBounds = unionBounds(candidateLine.map((candidate) => candidate.bounds));
      const candidateCenterY = candidateBounds.top + candidateBounds.height / 2;
      return Math.abs(centerY - candidateCenterY) <= lineVerticalGap;
    });

    if (line) {
      line.push(component);
    } else {
      lines.push([component]);
    }
  }

  return lines
    .map((lineComponents) => {
      const lineBounds = unionBounds(lineComponents.map((component) => component.bounds));
      const area = lineComponents.reduce((total, component) => total + component.area, 0);
      const horizontalPadding = Math.max(8, Math.round(lineBounds.width * 0.04));
      const verticalPadding = Math.max(4, Math.round(lineBounds.height * 0.2));
      const left = Math.max(0, lineBounds.left - horizontalPadding);
      const top = Math.max(0, lineBounds.top - verticalPadding);
      const right = Math.min(width, lineBounds.left + lineBounds.width + horizontalPadding);
      const bottom = Math.min(height, lineBounds.top + lineBounds.height + verticalPadding);

      return {
        bounds: {
          left,
          top,
          width: Math.max(1, right - left),
          height: Math.max(1, bottom - top),
        },
        area,
      };
    })
    .filter(
      (line) =>
        line.area >= minimumLineArea &&
        line.bounds.width >= Math.max(32, width * 0.16) &&
        line.bounds.height >= Math.max(12, height * 0.035),
    )
    .sort((left, right) => left.bounds.top - right.bounds.top)
    .map((line) => line.bounds)
    .slice(0, 12);
}

function getLineClusterBounds(lines: CropBounds[]): CropBounds | null {
  if (!lines.length) return null;

  const sortedLines = [...lines].sort((left, right) => left.top - right.top);
  const medianHeight =
    [...sortedLines].sort((left, right) => left.height - right.height)[
      Math.floor(sortedLines.length / 2)
    ]?.height ?? 1;
  const maxLineGap = Math.max(28, medianHeight * 1.6);
  const clusters: CropBounds[][] = [];

  for (const line of sortedLines) {
    const previousCluster = clusters.at(-1);
    const previousLine = previousCluster?.at(-1);
    const gap = previousLine ? line.top - (previousLine.top + previousLine.height) : 0;

    if (!previousCluster || gap > maxLineGap) {
      clusters.push([line]);
    } else {
      previousCluster.push(line);
    }
  }

  const bestCluster = clusters
    .map((cluster) => {
      const bounds = unionBounds(cluster);
      const inkLikeArea = cluster.reduce((total, line) => total + line.width * line.height, 0);
      const score = cluster.length * 1000 + inkLikeArea + bounds.width * 2;
      return { bounds, score };
    })
    .sort((left, right) => right.score - left.score)[0];

  return bestCluster?.bounds ?? null;
}

async function buildLabelMask(
  component: ComponentDetection,
  outputWidth: number,
  outputHeight: number,
): Promise<Buffer> {
  if (!component.mask || !component.maskWidth || !component.maskHeight) {
    throw new Error('Label component mask is unavailable');
  }

  const rgbaMask = Buffer.alloc(component.maskWidth * component.maskHeight * 4);
  for (let index = 0; index < component.mask.length; index += 1) {
    const alpha = component.mask[index] ? 255 : 0;
    const offset = index * 4;
    rgbaMask[offset] = 255;
    rgbaMask[offset + 1] = 255;
    rgbaMask[offset + 2] = 255;
    rgbaMask[offset + 3] = alpha;
  }

  return sharp(rgbaMask, {
    raw: {
      width: component.maskWidth,
      height: component.maskHeight,
      channels: 4,
    },
  })
    .resize({
      width: outputWidth,
      height: outputHeight,
      fit: 'fill',
      kernel: sharp.kernel.nearest,
    })
    .png()
    .toBuffer();
}

async function detectShippingLabelRegion(input: InputImage): Promise<LabelDetection | null> {
  const baseImage = sharp(input.buffer, { animated: true, failOn: 'none', pages: 1 })
    .rotate()
    .flatten({ background: '#ffffff' });
  const metadata = await baseImage.metadata();

  if (!metadata.width || !metadata.height) return null;

  const { data, info } = await baseImage
    .resize({
      width: LABEL_DETECTION_MAX_DIMENSION,
      height: LABEL_DETECTION_MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const detectedComponent = findLikelyLabelRegion(data, info.width, info.height, info.channels);
  if (!detectedComponent) return null;

  const scaled = scaleBounds(
    detectedComponent.bounds,
    metadata.width / info.width,
    metadata.height / info.height,
    metadata.width,
    metadata.height,
  );

  return {
    bounds: expandBounds(scaled, metadata.width, metadata.height, 0.005, 1),
    mask: await buildLabelMask(detectedComponent, metadata.width, metadata.height),
    width: metadata.width,
    height: metadata.height,
  };
}

async function detectHandwritingRegion(
  input: InputImage,
  labelRegion: LabelDetection | null,
): Promise<CropBounds | null> {
  const baseImage = sharp(input.buffer, { animated: true, failOn: 'none', pages: 1 })
    .rotate()
    .flatten({ background: '#ffffff' });
  const metadata = await baseImage.metadata();

  if (!metadata.width || !metadata.height) return null;

  const { data, info } = await baseImage
    .resize({
      width: HANDWRITING_DETECTION_MAX_DIMENSION,
      height: HANDWRITING_DETECTION_MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const scaledExcludedBounds = labelRegion
    ? scaleBoundsDown(
        labelRegion.bounds,
        metadata.width / info.width,
        metadata.height / info.height,
        info.width,
        info.height,
      )
    : null;

  const detectedBounds = findLikelyHandwritingRegion(
    data,
    info.width,
    info.height,
    info.channels,
    scaledExcludedBounds,
  );
  if (!detectedBounds) return null;

  const initialRegion = scaleBounds(
    detectedBounds,
    metadata.width / info.width,
    metadata.height / info.height,
    metadata.width,
    metadata.height,
  );
  const initialExpandedRegion = expandBounds(initialRegion, metadata.width, metadata.height, 0.04);
  const handwritingLineRegions = await detectHandwritingLineRegions(input, initialExpandedRegion);
  const lineClusterBounds = getLineClusterBounds(handwritingLineRegions);
  if (lineClusterBounds) {
    return expandBounds(lineClusterBounds, metadata.width, metadata.height, 0.035, 8);
  }

  const scaled = scaleBounds(
    detectedBounds,
    metadata.width / info.width,
    metadata.height / info.height,
    metadata.width,
    metadata.height,
  );

  return expandBounds(scaled, metadata.width, metadata.height, 0.04);
}

async function detectHandwritingLineRegions(
  input: InputImage,
  handwritingRegion: CropBounds,
): Promise<CropBounds[]> {
  const baseImage = sharp(input.buffer, { animated: true, failOn: 'none', pages: 1 })
    .rotate()
    .flatten({ background: '#ffffff' });

  const { data, info } = await baseImage
    .extract(handwritingRegion)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return findLikelyHandwritingLines(data, info.width, info.height, info.channels).map((line) => ({
    left: handwritingRegion.left + line.left,
    top: handwritingRegion.top + line.top,
    width: line.width,
    height: line.height,
  }));
}

type PaddleOcrPayload = {
  text?: unknown;
  confidence?: unknown;
  tokens?: unknown;
};

type PaddleOcrRunResult = OcrResult & {
  textRegion: CropBounds | null;
  tokenLineRegions: CropBounds[];
};

function parsePaddleTokenRegions(tokens: unknown): CropBounds[] {
  if (!Array.isArray(tokens)) return [];

  return tokens.flatMap((token) => {
    if (!token || typeof token !== 'object' || !('box' in token)) return [];
    const box = (token as { box?: unknown }).box;
    if (!Array.isArray(box) || box.length < 4) return [];

    const left = Number(box[0]);
    const top = Number(box[1]);
    const right = Number(box[2]);
    const bottom = Number(box[3]);
    if (![left, top, right, bottom].every(Number.isFinite)) return [];
    if (right <= left || bottom <= top) return [];

    return [
      {
        left: Math.round(left),
        top: Math.round(top),
        width: Math.round(right - left),
        height: Math.round(bottom - top),
      },
    ];
  });
}

function groupPaddleTokenLineRegions(tokenRegions: CropBounds[]): CropBounds[] {
  const lines: { top: number; height: number; regions: CropBounds[] }[] = [];

  for (const region of [...tokenRegions].sort((left, right) => left.top - right.top)) {
    const line = lines.find((candidateLine) => {
      const maxTopDistance = Math.max(18, candidateLine.height * 0.35);
      return Math.abs(region.top - candidateLine.top) <= maxTopDistance;
    });

    if (line) {
      line.regions.push(region);
      const tops = line.regions.map((lineRegion) => lineRegion.top);
      line.top = tops.reduce((total, top) => total + top, 0) / tops.length;
      line.height = Math.max(...line.regions.map((lineRegion) => lineRegion.height));
    } else {
      lines.push({ top: region.top, height: region.height, regions: [region] });
    }
  }

  return lines.map((line) => unionBounds(line.regions)).sort((left, right) => left.top - right.top);
}

async function runPaddleOcr(
  input: InputImage,
  handwritingRegion: CropBounds | null,
  labelRegion: CropBounds | null,
): Promise<PaddleOcrRunResult | null> {
  if (!shouldTryPaddleOcr()) return null;

  const metadata = await sharp(input.buffer, { animated: true, failOn: 'none', pages: 1 })
    .rotate()
    .metadata();
  if (!metadata.width || !metadata.height) return null;

  fs.mkdirSync(tempDir, { recursive: true });
  const inputPath = path.join(tempDir, `${randomUUID()}-paddle-ocr.png`);
  const image = sharp(input.buffer, { animated: true, failOn: 'none', pages: 1 })
    .rotate()
    .flatten({ background: '#ffffff' });

  await image.png().toFile(inputPath);

  try {
    const { stdout, stderr } = await execFileAsync(
      getPaddleOcrPythonBin(),
      [
        paddleOcrScriptPath,
        '--input',
        inputPath,
        '--model',
        PADDLE_OCR_MODEL_ID,
        ...(handwritingRegion
          ? [
              '--filter-crop',
              `${handwritingRegion.left},${handwritingRegion.top},${handwritingRegion.width},${handwritingRegion.height}`,
            ]
          : []),
        ...(labelRegion
          ? [
              '--exclude-crop',
              `${labelRegion.left},${labelRegion.top},${labelRegion.width},${labelRegion.height}`,
            ]
          : []),
      ],
      {
        env: {
          ...process.env,
          CUDA_VISIBLE_DEVICES: '',
          FLAGS_use_mkldnn: '0',
          TMPDIR: os.tmpdir(),
        },
        timeout: getOcrTimeoutMs(),
        maxBuffer: 1024 * 1024 * 8,
      },
    );

    if (stderr.trim()) console.warn(`PaddleOCR stderr: ${stderr.trim()}`);

    const jsonLine = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .at(-1);
    if (!jsonLine) return null;

    const payload = JSON.parse(jsonLine) as PaddleOcrPayload;
    const text = typeof payload.text === 'string' ? normalizeOcrText(payload.text) : '';
    const confidence = Number(payload.confidence ?? 0);
    const tokenRegions = parsePaddleTokenRegions(payload.tokens);
    const tokenLineRegions = groupPaddleTokenLineRegions(tokenRegions).map((region) =>
      expandBounds(region, metadata.width ?? 1, metadata.height ?? 1, 0.025, 4),
    );
    const textRegion = tokenLineRegions.length
      ? expandBounds(unionBounds(tokenLineRegions), metadata.width, metadata.height, 0.025, 6)
      : null;

    return {
      text,
      confidence: Number.isFinite(confidence) ? confidence * 100 : 0,
      textRegion,
      tokenLineRegions,
    };
  } catch (error) {
    const message = getExecErrorMessage(error);
    throw new Error(
      `PaddleOCR failed. ${message} Install local OCR deps with "pnpm --dir apps/image_processor run install:ocr".`,
    );
  } finally {
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
  }
}

export async function extractTextFromImageDebug(input: InputImage): Promise<OcrDebugResult> {
  const labelRegion = await detectShippingLabelRegion(input);
  const handwritingRegion = await detectHandwritingRegion(input, labelRegion);
  const handwritingLineRegions = handwritingRegion
    ? await detectHandwritingLineRegions(input, handwritingRegion)
    : [];
  const paddleOcrResult = await runPaddleOcr(input, handwritingRegion, labelRegion?.bounds || null);
  if (paddleOcrResult?.text) {
    const selectedRegion = paddleOcrResult.textRegion || handwritingRegion;
    const selectedLineRegions = paddleOcrResult.tokenLineRegions.length
      ? paddleOcrResult.tokenLineRegions
      : handwritingLineRegions;
    const selectedOcrResult = {
      text: paddleOcrResult.text,
      confidence: paddleOcrResult.confidence,
    };

    return {
      modelId: PADDLE_OCR_MODEL_ID,
      detectedLabelRegion: labelRegion?.bounds || null,
      detectedLabelMask: labelRegion?.mask || null,
      detectedHandwritingRegion: handwritingRegion,
      detectedHandwritingLineRegions: selectedLineRegions,
      selectedSource: 'paddleocr',
      selectedRegion,
      selectedResult: selectedOcrResult,
      labelRegionResult: null,
      handwritingRegionResult: selectedOcrResult,
      fullImageResult: selectedOcrResult,
    };
  }

  throw new Error(
    `PaddleOCR did not return text. Install local OCR deps with "pnpm --dir apps/image_processor run install:ocr" or check the detected handwriting region.`,
  );
}

export async function extractTextFromImage(input: InputImage): Promise<OcrResult> {
  const debugResult = await extractTextFromImageDebug(input);
  return debugResult.selectedResult;
}

function getDebugOverlaySvg(width: number, height: number, debugResult: OcrDebugResult) {
  const elements: string[] = [];

  if (debugResult.detectedLabelRegion && !debugResult.detectedLabelMask) {
    const region = debugResult.detectedLabelRegion;
    elements.push(
      `<rect x="${region.left}" y="${region.top}" width="${region.width}" height="${region.height}" fill="none" stroke="#f59e0b" stroke-width="8" />`,
    );
  }

  if (debugResult.detectedHandwritingRegion) {
    const region = debugResult.detectedHandwritingRegion;
    elements.push(
      `<rect x="${region.left}" y="${region.top}" width="${region.width}" height="${region.height}" fill="none" stroke="#38bdf8" stroke-width="8" stroke-dasharray="18 10" />`,
    );
  }

  for (const region of debugResult.detectedHandwritingLineRegions) {
    elements.push(
      `<rect x="${region.left}" y="${region.top}" width="${region.width}" height="${region.height}" fill="none" stroke="#f97316" stroke-width="4" stroke-dasharray="10 8" />`,
    );
  }

  if (debugResult.selectedRegion) {
    const region = debugResult.selectedRegion;
    elements.push(
      `<rect x="${region.left}" y="${region.top}" width="${region.width}" height="${region.height}" fill="rgba(16, 185, 129, 0.12)" stroke="#10b981" stroke-width="10" />`,
    );
  }

  const bannerHeight = Math.min(96, Math.max(56, Math.round(height * 0.1)));
  const statusText = `selected=${debugResult.selectedSource} model=${debugResult.modelId}`;
  elements.push(
    `<rect x="0" y="0" width="${width}" height="${bannerHeight}" fill="rgba(0,0,0,0.58)" />`,
  );
  elements.push(
    `<text x="24" y="${Math.round(bannerHeight * 0.6)}" fill="#ffffff" font-size="28" font-family="Arial, sans-serif">${escapeXml(statusText)}</text>`,
  );

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${elements.join('')}</svg>`,
  );
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function buildDebugLabelMaskOverlay(mask: Buffer, width: number, height: number) {
  const { data, info } = await sharp(mask)
    .resize({
      width,
      height,
      fit: 'fill',
      kernel: sharp.kernel.nearest,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const tinted = Buffer.alloc(info.width * info.height * 4);
  for (let index = 0; index < info.width * info.height; index += 1) {
    const alpha = data[index * 4 + 3] ?? 0;
    const offset = index * 4;
    tinted[offset] = 245;
    tinted[offset + 1] = 158;
    tinted[offset + 2] = 11;
    tinted[offset + 3] = alpha > 16 ? 96 : 0;
  }

  return sharp(tinted, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();
}

export async function renderTextFromImageDebugOverlay(
  input: InputImage,
  debugResult: OcrDebugResult,
): Promise<Buffer> {
  const normalized = sharp(input.buffer, { animated: true, failOn: 'none', pages: 1 })
    .rotate()
    .flatten({ background: '#ffffff' });
  const metadata = await normalized.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error('Unable to determine image dimensions for OCR debug overlay');
  }

  const materialized = await normalized.raw().toBuffer({ resolveWithObject: true });

  const composites: sharp.OverlayOptions[] = [];
  if (debugResult.detectedLabelMask) {
    composites.push({
      input: await buildDebugLabelMaskOverlay(
        debugResult.detectedLabelMask,
        materialized.info.width,
        materialized.info.height,
      ),
    });
  }
  composites.push({
    input: getDebugOverlaySvg(materialized.info.width, materialized.info.height, debugResult),
  });

  return sharp(materialized.data, {
    raw: {
      width: materialized.info.width,
      height: materialized.info.height,
      channels: materialized.info.channels,
    },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

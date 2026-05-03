import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { pipeline } from '@huggingface/transformers';
import sharp from 'sharp';
import { tempDir } from '../directories.js';
import {
  ensureDirectory,
  getExecErrorMessage,
  getImageProcessorModelCacheDir,
} from './background_removal/shared.js';
import type { InputImage } from './image_processing_types.js';

const OCR_BACKEND = process.env.OCR_BACKEND?.trim().toLowerCase() || 'auto';
const OCR_SPACE_API_KEY = process.env.OCR_SPACE_API_KEY?.trim() || '';
const OCR_SPACE_API_URL =
  process.env.OCR_SPACE_API_URL?.trim() || 'https://api.ocr.space/parse/image';
const OCR_SPACE_ENGINE = process.env.OCR_SPACE_ENGINE?.trim() || '3';
const OCR_SPACE_LANGUAGE = process.env.OCR_SPACE_LANGUAGE?.trim() || 'eng';
const PADDLE_OCR_MODEL_ID = process.env.PADDLE_OCR_MODEL_ID?.trim() || 'PP-OCRv5_server_rec';
const BOX_DETECTION_MODEL_ID =
  process.env.BOX_DETECTION_MODEL_ID?.trim() || 'Xenova/detr-resnet-50';
const execFileAsync = promisify(execFile);
const serviceDir = path.dirname(fileURLToPath(import.meta.url));
const paddleOcrScriptPath = path.resolve(serviceDir, '../../scripts/run_paddle_ocr.py');
const boxDetectionCacheDir = getImageProcessorModelCacheDir('box_detection');

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
const CARDBOARD_DETECTION_MAX_DIMENSION = 512;
const BOX_DETECTION_MAX_DIMENSION = 800;
const LABEL_BRIGHTNESS_THRESHOLD = 205;
const LABEL_CHROMA_THRESHOLD = 45;
const LABEL_MASK_PADDING_PX = 10;
const OCR_SPACE_LEFT_PADDING_PX = 20;
const CARDBOARD_MIN_PIXEL_RATIO = 0.08;
const CARDBOARD_MIN_BBOX_RATIO = 0.16;
const CARDBOARD_MAX_BBOX_RATIO = 0.98;
const BOX_DETECTION_MIN_AREA_RATIO = 0.08;
const BOX_DETECTION_SCORE_THRESHOLD = 0.2;
const LABEL_MIN_PIXEL_RATIO = 0.02;
const LABEL_MIN_BBOX_RATIO = 0.035;
const LABEL_MAX_BBOX_RATIO = 0.9;
const HANDWRITING_DETECTION_MAX_DIMENSION = 512;
const HANDWRITING_BRIGHTNESS_THRESHOLD = 120;
const HANDWRITING_CHROMA_THRESHOLD = 90;
const HANDWRITING_COMPONENT_MIN_AREA = 8;
const HANDWRITING_COMPONENT_MAX_BBOX_RATIO = 0.035;
const HANDWRITING_LINE_MARKER_LOOKBACK_PX = 28;

export type OcrResult = {
  text: string;
  confidence: number;
  trackingNumber: string;
};

export type OcrDebugResult = {
  modelId: string;
  detectedCardboardBoxRegion: CropBounds | null;
  detectedLabelRegion: CropBounds | null;
  detectedLabelMask: Buffer | null;
  detectedTrackingLineRegion: CropBounds | null;
  detectedHandwritingRegion: CropBounds | null;
  detectedHandwritingLineRegions: CropBounds[];
  lineRegionSource: 'provider' | 'heuristic';
  selectedSource: 'ocrspace' | 'paddleocr';
  selectedRegion: CropBounds | null;
  selectedResult: OcrResult;
  labelRegionResult: OcrResult | null;
  handwritingRegionResult: OcrResult | null;
  fullImageResult: OcrResult;
  timings: OcrDebugTimings;
};

type OcrSource = OcrDebugResult['selectedSource'];

type OcrDebugTimings = {
  totalMs: number;
  boxDetectionMs?: number;
  boxModelMs?: number;
  labelDetectionMs?: number;
  trackingDetectionMs?: number;
  trackingOcrSpaceMs?: number;
  trackingPaddleMs?: number;
  handwritingDetectionMs?: number;
  handwritingLineDetectionMs?: number;
  mainOcrSpaceMs?: number;
  mainPaddleMs?: number;
};

type OcrTextLine = {
  text: string;
  bounds: CropBounds;
  words?: OcrTextWord[];
};

type OcrTextWord = {
  text: string;
  bounds: CropBounds;
};

type TrackingLineMatch = {
  trackingNumber: string;
  lineRegion: CropBounds | null;
  line?: string;
};

type ObjectDetectionBox = {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
};

type ObjectDetectionResult = {
  label: string;
  score: number;
  box: ObjectDetectionBox;
};

type ObjectDetectionPipeline = (
  input: Blob,
  options?: { threshold?: number },
) => Promise<ObjectDetectionResult[] | ObjectDetectionResult[][]>;

let boxDetectorPromise: Promise<Awaited<ReturnType<typeof pipeline>>> | null = null;

function normalizeOcrText(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeTrackingCandidate(value: string) {
  return value.replace(/[^0-9A-Z]/gi, '').toUpperCase();
}

type TrackingCandidate = {
  value: string;
  line: string;
  score: number;
};

function extractDigitTrackingCandidatesFromLine(line: string, lengths: number[]) {
  const sanitizedLine = line.replace(/[^0-9- ]/gi, ' ');
  const orderedLengths = [...lengths].sort((left, right) => right - left);
  const matches: string[] = [];

  for (const length of orderedLengths) {
    const matcher = new RegExp(`(?=((?:\\d[\\s-]*){${length}}))`, 'g');
    for (const match of sanitizedLine.matchAll(matcher)) {
      const candidate = normalizeTrackingCandidate(match[1] ?? '');
      if (candidate.length === length) matches.push(candidate);
    }
  }

  return [...new Set(matches)];
}

function rankTrackingCandidates(candidates: TrackingCandidate[]) {
  return [...candidates].sort(
    (left, right) => right.score - left.score || left.value.length - right.value.length,
  );
}

function hasTrackingLineHint(line: string) {
  return /\bTRK#?\b|\bTRCK\b|\bTRACK\b|\bTRACKING\b/.test(line);
}

function isLowSignalDigitCandidate(candidate: string) {
  const zeroCount = [...candidate].filter((digit) => digit === '0').length;
  return /^0+$/.test(candidate) || zeroCount / Math.max(1, candidate.length) > 0.65;
}

function findTrackingCandidateBounds(line: OcrTextLine, candidate: string): CropBounds | null {
  const normalizedCandidate = normalizeTrackingCandidate(candidate);
  const words = line.words?.filter((word) => normalizeTrackingCandidate(word.text)) ?? [];
  if (!normalizedCandidate || !words.length) return line.bounds;

  for (let startIndex = 0; startIndex < words.length; startIndex += 1) {
    let joined = '';
    const matchingWords: OcrTextWord[] = [];

    for (let endIndex = startIndex; endIndex < words.length; endIndex += 1) {
      const word = words[endIndex];
      if (!word) continue;
      joined += normalizeTrackingCandidate(word.text);
      matchingWords.push(word);

      if (joined === normalizedCandidate) {
        return unionBounds(matchingWords.map((matchingWord) => matchingWord.bounds));
      }

      if (joined.includes(normalizedCandidate)) {
        return unionBounds(matchingWords.map((matchingWord) => matchingWord.bounds));
      }

      if (!normalizedCandidate.startsWith(joined)) break;
    }
  }

  const containingWord = words.find((word) =>
    normalizeTrackingCandidate(word.text).includes(normalizedCandidate),
  );

  return containingWord?.bounds ?? line.bounds;
}

function scoreTrackingCandidateLine(
  score: number,
  line: OcrTextLine,
  candidate: string,
  hasFedex: boolean,
  textTop: number,
  textBottom: number,
  medianLineHeight: number,
) {
  const candidateBounds = findTrackingCandidateBounds(line, candidate);
  const normalizedLine = normalizeOcrText(line.text).toUpperCase();
  const lineHeight = Math.max(line.bounds.height, candidateBounds?.height ?? 0);
  const centerY = candidateBounds
    ? candidateBounds.top + candidateBounds.height / 2
    : line.bounds.top + line.bounds.height / 2;
  const centerX = candidateBounds
    ? candidateBounds.left + candidateBounds.width / 2
    : line.bounds.left + line.bounds.width / 2;
  const relativeY = (centerY - textTop) / Math.max(1, textBottom - textTop);
  const relativeX = (centerX - line.bounds.left) / Math.max(1, line.bounds.width);
  let adjustedScore = score;

  if (hasFedex && /^\d{12}$|^\d{15}$/.test(candidate)) {
    if (hasTrackingLineHint(normalizedLine)) adjustedScore += 75;
    if (!hasTrackingLineHint(normalizedLine) && relativeX > 0.45) adjustedScore += 20;
    if (candidate.startsWith('96')) adjustedScore -= 65;
    if (isLowSignalDigitCandidate(candidate)) adjustedScore -= 50;
    if (/[()]/.test(normalizedLine)) adjustedScore -= 25;
    adjustedScore += relativeY * 55;
    if (relativeY < 0.35) adjustedScore -= 55;
    if (lineHeight < medianLineHeight * 0.85) adjustedScore -= 18;
  }

  if (
    /\b(?:INVOICE|CUSTOMER|PO\s*NUMBER|DATE|SHIP(?:PING)?|SPECIAL|TOTAL)\b/.test(normalizedLine)
  ) {
    adjustedScore -= 35;
  }

  return { score: adjustedScore, bounds: candidateBounds };
}

function formatTimingMs(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${Math.max(0, Math.round(value))}ms`
    : null;
}

type DebugTimingRow = {
  operation: string;
  durationMs: number;
  runningTotalMs: number;
};

function buildDebugTimingRows(timings: OcrDebugTimings): DebugTimingRow[] {
  const operations = [
    ['box detection', timings.boxDetectionMs],
    ['label detection', timings.labelDetectionMs],
    ['tracking detection', timings.trackingDetectionMs],
    ['handwriting detection', timings.handwritingDetectionMs],
    ['handwriting lines', timings.handwritingLineDetectionMs],
    [
      timings.mainOcrSpaceMs !== undefined ? 'main OCR (ocr.space)' : 'main OCR (paddle)',
      timings.mainOcrSpaceMs ?? timings.mainPaddleMs,
    ],
  ] as const;
  const rows: DebugTimingRow[] = [];
  let runningTotalMs = 0;

  for (const [operation, durationMs] of operations) {
    if (durationMs === undefined || !Number.isFinite(durationMs)) continue;
    const normalizedDurationMs = Math.max(0, Math.round(durationMs));
    runningTotalMs += normalizedDurationMs;
    rows.push({
      operation,
      durationMs: normalizedDurationMs,
      runningTotalMs,
    });
  }

  return rows;
}

function extractTrackingMatchFromTextLines(
  lines: OcrTextLine[],
  fullText = '',
): TrackingLineMatch | null {
  const normalizedFullText = normalizeOcrText(fullText).toUpperCase();
  const hasUps = /\bUPS\b|UNITED\s+PARCEL/.test(normalizedFullText);
  const hasUsps = /\bUSPS\b|\bPOSTAL\b|UNITED\s+STATES\s+POSTAL/.test(normalizedFullText);
  const hasFedex = /\bFEDEX\b|FEDERAL\s+EXPRESS/.test(normalizedFullText);
  const candidates: Array<TrackingCandidate & { bounds: CropBounds | null }> = [];
  const boundedLines = lines.filter((line) => line.bounds.width > 0 && line.bounds.height > 0);
  const textTop = boundedLines.length
    ? Math.min(...boundedLines.map((line) => line.bounds.top))
    : 0;
  const textBottom = boundedLines.length
    ? Math.max(...boundedLines.map((line) => line.bounds.top + line.bounds.height))
    : 1;
  const sortedLineHeights = boundedLines
    .map((line) => line.bounds.height)
    .sort((left, right) => left - right);
  const medianLineHeight = sortedLineHeights.length
    ? (sortedLineHeights[Math.floor(sortedLineHeights.length / 2)] ?? 1)
    : 1;

  for (const line of lines) {
    const normalizedLine = normalizeOcrText(line.text).toUpperCase();
    if (!normalizedLine) continue;

    const lineHasTrackingHint = hasTrackingLineHint(normalizedLine);
    const lineHasFedexHint = /\bFEDEX\b|FEDERAL\s+EXPRESS/.test(normalizedLine);
    const lineHasUspsHint = /\bUSPS\b|\bPOSTAL\b/.test(normalizedLine);
    const compactLine = normalizedLine.replace(/[^0-9A-Z]/g, '');

    const upsMatch = compactLine.match(/1Z[0-9A-Z]{16}/i);
    if (upsMatch) {
      const value = normalizeTrackingCandidate(upsMatch[0]);
      const scoredCandidate = scoreTrackingCandidateLine(
        220,
        line,
        value,
        hasFedex,
        textTop,
        textBottom,
        medianLineHeight,
      );
      candidates.push({
        value,
        line: normalizedLine,
        score: scoredCandidate.score,
        bounds: scoredCandidate.bounds,
      });
    }

    const uspsInternationalMatch = compactLine.match(/[A-Z]{2}\d{9}[A-Z]{2}/i);
    if (uspsInternationalMatch) {
      const value = normalizeTrackingCandidate(uspsInternationalMatch[0]);
      const scoredCandidate = scoreTrackingCandidateLine(
        210,
        line,
        value,
        hasFedex,
        textTop,
        textBottom,
        medianLineHeight,
      );
      candidates.push({
        value,
        line: normalizedLine,
        score: scoredCandidate.score,
        bounds: scoredCandidate.bounds,
      });
    }

    for (const candidate of extractDigitTrackingCandidatesFromLine(
      normalizedLine,
      [12, 15, 20, 22],
    )) {
      let score = 0;

      if (lineHasTrackingHint) score += 100;
      if (lineHasFedexHint) score += 50;
      if (lineHasUspsHint) score += 40;

      if (candidate.length === 12) score += 12;
      if (candidate.length === 15) score += 10;
      if (candidate.length === 20) score += 8;
      if (candidate.length === 22) score += 6;

      if (hasFedex && (candidate.length === 12 || candidate.length === 15)) score += 40;
      if (hasUsps && (candidate.length === 20 || candidate.length === 22)) score += 40;
      if (hasUps && candidate.startsWith('1Z')) score += 40;
      const scoredCandidate = scoreTrackingCandidateLine(
        score,
        line,
        candidate,
        hasFedex,
        textTop,
        textBottom,
        medianLineHeight,
      );

      candidates.push({
        value: candidate,
        line: normalizedLine,
        score: scoredCandidate.score,
        bounds: scoredCandidate.bounds,
      });
    }
  }

  const bestCandidate = [...candidates].sort(
    (left, right) => right.score - left.score || left.value.length - right.value.length,
  )[0];
  const preferredCandidate =
    bestCandidate && !hasTrackingLineHint(bestCandidate.line)
      ? candidates.find(
          (candidate) =>
            candidate.value === bestCandidate.value &&
            candidate.bounds &&
            hasTrackingLineHint(candidate.line),
        )
      : null;
  const selectedCandidate = preferredCandidate ?? bestCandidate;

  return selectedCandidate
    ? {
        trackingNumber: selectedCandidate.value,
        lineRegion: selectedCandidate.bounds,
        line: selectedCandidate.line,
      }
    : null;
}

function extractTrackingNumberFromText(text: string): string {
  const normalizedText = normalizeOcrText(text).toUpperCase();
  if (!normalizedText) return '';

  const lines = normalizedText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const compactText = normalizedText.replace(/[^0-9A-Z]/g, ' ');
  const joinedText = normalizedText.replace(/[^0-9A-Z]/g, '');
  const hasUps = /\bUPS\b|UNITED\s+PARCEL/.test(normalizedText);
  const hasUsps = /\bUSPS\b|\bPOSTAL\b|UNITED\s+STATES\s+POSTAL/.test(normalizedText);
  const hasFedex = /\bFEDEX\b|FEDERAL\s+EXPRESS/.test(normalizedText);

  const upsMatch = joinedText.match(/1Z[0-9A-Z]{16}/i);
  if (upsMatch) return normalizeTrackingCandidate(upsMatch[0]);

  const uspsInternationalMatch = joinedText.match(/[A-Z]{2}\d{9}[A-Z]{2}/i);
  if (uspsInternationalMatch) return normalizeTrackingCandidate(uspsInternationalMatch[0]);

  const lineCandidates: TrackingCandidate[] = [];

  for (const line of lines) {
    const lineHasTrackingHint = hasTrackingLineHint(line);
    const lineHasFedexHint = /\bFEDEX\b|FEDERAL\s+EXPRESS/.test(line);
    const lineHasUspsHint = /\bUSPS\b|\bPOSTAL\b/.test(line);

    for (const candidate of extractDigitTrackingCandidatesFromLine(line, [12, 15, 20, 22])) {
      let score = 0;

      if (lineHasTrackingHint) score += 100;
      if (lineHasFedexHint) score += 50;
      if (lineHasUspsHint) score += 40;

      if (candidate.length === 12) score += 12;
      if (candidate.length === 15) score += 10;
      if (candidate.length === 20) score += 8;
      if (candidate.length === 22) score += 6;

      if (hasFedex && (candidate.length === 12 || candidate.length === 15)) score += 40;
      if (hasUsps && (candidate.length === 20 || candidate.length === 22)) score += 40;
      if (hasFedex && lineHasTrackingHint) score += 75;
      if (hasFedex && candidate.startsWith('96')) score -= 65;
      if (hasFedex && isLowSignalDigitCandidate(candidate)) score -= 50;
      if (hasFedex && /[()]/.test(line)) score -= 25;

      lineCandidates.push({ value: candidate, line, score });
    }
  }

  const rankedLineCandidates = rankTrackingCandidates(lineCandidates);

  const digitCandidates = [
    ...compactText.matchAll(/(?:\d[\s-]*){22}|(?:\d[\s-]*){20}|(?:\d[\s-]*){15}|(?:\d[\s-]*){12}/g),
  ]
    .map((match) => normalizeTrackingCandidate(match[0]))
    .filter((candidate) => /^\d{12}$|^\d{15}$|^\d{20}$|^\d{22}$/.test(candidate));

  if (hasUsps) {
    const uspsLineCandidate = rankedLineCandidates.find((candidate) =>
      /^\d{20}$|^\d{22}$/.test(candidate.value),
    );
    if (uspsLineCandidate) return uspsLineCandidate.value;

    const uspsCandidate = digitCandidates.find((candidate) => /^\d{20}$|^\d{22}$/.test(candidate));
    if (uspsCandidate) return uspsCandidate;
  }

  if (hasFedex) {
    const fedexLineCandidate = rankedLineCandidates.find((candidate) =>
      /^\d{12}$|^\d{15}$|^\d{20}$|^\d{22}$/.test(candidate.value),
    );
    if (fedexLineCandidate) return fedexLineCandidate.value;

    const fedexCandidate = digitCandidates.find((candidate) =>
      /^\d{12}$|^\d{15}$|^\d{20}$|^\d{22}$/.test(candidate),
    );
    if (fedexCandidate) return fedexCandidate;
  }

  if (hasUps) {
    const upsCandidate = digitCandidates.find((candidate) => /^\d{9,26}$/.test(candidate));
    if (upsCandidate) return upsCandidate;
  }

  if (rankedLineCandidates[0]) return rankedLineCandidates[0].value;

  return digitCandidates[0] ?? '';
}

function shouldTryPaddleOcr() {
  return (
    OCR_BACKEND === 'auto' ||
    OCR_BACKEND === 'paddleocr' ||
    OCR_BACKEND === 'paddle' ||
    OCR_BACKEND === 'local'
  );
}

function shouldTryOcrSpace() {
  return (
    OCR_BACKEND === 'auto' ||
    OCR_BACKEND === 'ocrspace' ||
    OCR_BACKEND === 'ocr.space' ||
    OCR_BACKEND === 'cloud'
  );
}

function getDefaultPaddleOcrVenvDir() {
  const sharedVenvRootDir = process.env.IMAGE_PROCESSOR_VENVS_DIR?.trim();
  if (sharedVenvRootDir) {
    return path.resolve(sharedVenvRootDir, '.venv-ocr');
  }

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

function getOcrSpaceLanguage(ocrEngine = OCR_SPACE_ENGINE) {
  if (process.env.OCR_SPACE_LANGUAGE?.trim()) {
    return process.env.OCR_SPACE_LANGUAGE.trim();
  }

  return ocrEngine === '3' ? 'auto' : OCR_SPACE_LANGUAGE;
}

function getLabelMaskPixel(data: Uint8Array, offset: number) {
  const red = data[offset] ?? 0;
  const green = data[offset + 1] ?? 0;
  const blue = data[offset + 2] ?? 0;
  const brightness = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);

  return brightness >= LABEL_BRIGHTNESS_THRESHOLD && chroma <= LABEL_CHROMA_THRESHOLD;
}

function getCardboardMaskPixel(data: Uint8Array, offset: number) {
  const red = data[offset] ?? 0;
  const green = data[offset + 1] ?? 0;
  const blue = data[offset + 2] ?? 0;
  const brightness = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
  const looksBrown = red >= green && green >= blue && red - blue >= 12;
  const looksNeutral = chroma <= 32;

  return brightness >= 85 && brightness <= 235 && chroma <= 95 && (looksNeutral || looksBrown);
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

function padBoundsWithinRegion(
  bounds: CropBounds,
  region: CropBounds,
  paddingPx: number,
): CropBounds {
  const left = Math.max(region.left, bounds.left - paddingPx);
  const top = Math.max(region.top, bounds.top - paddingPx);
  const right = Math.min(region.left + region.width, bounds.left + bounds.width + paddingPx);
  const bottom = Math.min(region.top + region.height, bounds.top + bounds.height + paddingPx);

  return {
    left,
    top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}

function padBoundsWithinRegionAsymmetric(
  bounds: CropBounds,
  region: CropBounds,
  padding: { left: number; top: number; right: number; bottom: number },
): CropBounds {
  const left = Math.max(region.left, bounds.left - padding.left);
  const top = Math.max(region.top, bounds.top - padding.top);
  const right = Math.min(region.left + region.width, bounds.left + bounds.width + padding.right);
  const bottom = Math.min(region.top + region.height, bounds.top + bounds.height + padding.bottom);

  return {
    left,
    top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}

function intersectBounds(left: CropBounds, right: CropBounds): CropBounds | null {
  const intersectionLeft = Math.max(left.left, right.left);
  const intersectionTop = Math.max(left.top, right.top);
  const intersectionRight = Math.min(left.left + left.width, right.left + right.width);
  const intersectionBottom = Math.min(left.top + left.height, right.top + right.height);

  if (intersectionRight <= intersectionLeft || intersectionBottom <= intersectionTop) {
    return null;
  }

  return {
    left: intersectionLeft,
    top: intersectionTop,
    width: intersectionRight - intersectionLeft,
    height: intersectionBottom - intersectionTop,
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

function offsetBounds(bounds: CropBounds, offset: { left: number; top: number }): CropBounds {
  return {
    left: bounds.left + offset.left,
    top: bounds.top + offset.top,
    width: bounds.width,
    height: bounds.height,
  };
}

async function getBoxDetector() {
  if (!boxDetectorPromise) {
    ensureDirectory(boxDetectionCacheDir);
    boxDetectorPromise = pipeline('object-detection', BOX_DETECTION_MODEL_ID, {
      cache_dir: boxDetectionCacheDir,
    });
  }

  return boxDetectorPromise as Promise<ObjectDetectionPipeline>;
}

function clampDetectedBox(box: ObjectDetectionBox, maxWidth: number, maxHeight: number) {
  const left = Math.max(0, Math.floor(Math.min(box.xmin, box.xmax)));
  const top = Math.max(0, Math.floor(Math.min(box.ymin, box.ymax)));
  const right = Math.min(maxWidth, Math.ceil(Math.max(box.xmin, box.xmax)));
  const bottom = Math.min(maxHeight, Math.ceil(Math.max(box.ymin, box.ymax)));

  if (right <= left || bottom <= top) return null;

  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
  };
}

function scoreBoxDetectionCandidate(
  bounds: CropBounds,
  score: number,
  width: number,
  height: number,
) {
  const areaRatio = (bounds.width * bounds.height) / (width * height);
  if (areaRatio < BOX_DETECTION_MIN_AREA_RATIO) return -Infinity;

  const centerX = bounds.left + bounds.width / 2;
  const centerY = bounds.top + bounds.height / 2;
  const centerDistance =
    Math.hypot(centerX - width / 2, centerY - height / 2) / Math.hypot(width / 2, height / 2);

  return score * 0.9 + areaRatio * 1.8 - centerDistance * 0.35;
}

async function detectCardboardBoxRegionWithDetr(
  input: InputImage,
  timings?: Partial<OcrDebugTimings>,
): Promise<CropBounds | null> {
  const baseImage = sharp(input.buffer, { animated: true, failOn: 'none', pages: 1 })
    .rotate()
    .flatten({ background: '#ffffff' });
  const metadata = await baseImage.metadata();

  if (!metadata.width || !metadata.height) return null;

  const resized = baseImage.resize({
    width: BOX_DETECTION_MAX_DIMENSION,
    height: BOX_DETECTION_MAX_DIMENSION,
    fit: 'inside',
    withoutEnlargement: true,
  });
  const resizedMetadata = await resized.metadata();
  if (!resizedMetadata.width || !resizedMetadata.height) return null;

  const detectorStartedAt = Date.now();
  const detector = await getBoxDetector();
  const resizedBuffer = await resized.png().toBuffer();
  const resizedBytes = Uint8Array.from(resizedBuffer);
  const detectionsRaw = await detector(new Blob([resizedBytes], { type: 'image/png' }), {
    threshold: BOX_DETECTION_SCORE_THRESHOLD,
  });
  if (timings) timings.boxModelMs = Date.now() - detectorStartedAt;

  const detections = Array.isArray(detectionsRaw[0])
    ? (detectionsRaw[0] as ObjectDetectionResult[])
    : (detectionsRaw as ObjectDetectionResult[]);

  let bestBounds: CropBounds | null = null;
  let bestScore = -Infinity;

  for (const detection of detections) {
    const candidateBounds = clampDetectedBox(
      detection.box,
      resizedMetadata.width,
      resizedMetadata.height,
    );
    if (!candidateBounds) continue;

    const candidateScore = scoreBoxDetectionCandidate(
      candidateBounds,
      detection.score,
      resizedMetadata.width,
      resizedMetadata.height,
    );
    if (candidateScore <= bestScore) continue;

    bestScore = candidateScore;
    bestBounds = candidateBounds;
  }

  if (!bestBounds) return null;

  const scaled = scaleBounds(
    bestBounds,
    metadata.width / resizedMetadata.width,
    metadata.height / resizedMetadata.height,
    metadata.width,
    metadata.height,
  );

  const refined = await refineCardboardBoxRegionWithinDetrBounds(
    baseImage,
    scaled,
    metadata.width,
    metadata.height,
  );

  return expandBounds(refined ?? scaled, metadata.width, metadata.height, 0.02, 10);
}

async function refineCardboardBoxRegionWithinDetrBounds(
  image: sharp.Sharp,
  detrBounds: CropBounds,
  imageWidth: number,
  imageHeight: number,
): Promise<CropBounds | null> {
  const searchRegion = intersectBounds(detrBounds, {
    left: 0,
    top: 0,
    width: imageWidth,
    height: imageHeight,
  });
  if (!searchRegion) return null;

  const { data, info } = await image
    .clone()
    .extract(searchRegion)
    .resize({
      width: CARDBOARD_DETECTION_MAX_DIMENSION,
      height: CARDBOARD_DETECTION_MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const refinedBounds = findLikelyCardboardRegion(data, info.width, info.height, info.channels);
  if (!refinedBounds) return null;

  const scaledRefinedBounds = scaleBounds(
    refinedBounds,
    searchRegion.width / info.width,
    searchRegion.height / info.height,
    searchRegion.width,
    searchRegion.height,
  );
  const offsetRefinedBounds = offsetBounds(scaledRefinedBounds, {
    left: searchRegion.left,
    top: searchRegion.top,
  });
  const refinedArea = offsetRefinedBounds.width * offsetRefinedBounds.height;
  const detrArea = Math.max(1, detrBounds.width * detrBounds.height);

  if (refinedArea < detrArea * 0.35) return null;

  return offsetRefinedBounds;
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

function findLikelyCardboardRegion(
  data: Uint8Array,
  width: number,
  height: number,
  channels: number,
): CropBounds | null {
  const totalPixels = width * height;
  const minPixels = Math.max(256, Math.round(totalPixels * CARDBOARD_MIN_PIXEL_RATIO));
  const minBoundingPixels = Math.round(totalPixels * CARDBOARD_MIN_BBOX_RATIO);
  const maxBoundingPixels = Math.round(totalPixels * CARDBOARD_MAX_BBOX_RATIO);
  const visited = new Uint8Array(totalPixels);
  let bestBounds: CropBounds | null = null;
  let bestScore = -Infinity;

  for (let startIndex = 0; startIndex < totalPixels; startIndex += 1) {
    if (visited[startIndex]) continue;
    visited[startIndex] = 1;

    if (!getCardboardMaskPixel(data, startIndex * channels)) continue;

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

      const neighbors = [
        index - 1,
        index + 1,
        index - width,
        index + width,
        index - width - 1,
        index - width + 1,
        index + width - 1,
        index + width + 1,
      ];
      for (const neighbor of neighbors) {
        if (neighbor < 0 || neighbor >= totalPixels || visited[neighbor]) continue;

        const neighborX = neighbor % width;
        const neighborY = Math.floor(neighbor / width);
        if (Math.max(Math.abs(neighborX - x), Math.abs(neighborY - y)) > 1) continue;

        visited[neighbor] = 1;
        if (getCardboardMaskPixel(data, neighbor * channels)) {
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
    if (fillRatio < 0.32) continue;

    const aspectRatio = bounds.width / Math.max(bounds.height, 1);
    if (aspectRatio < 0.75 || aspectRatio > 2.6) continue;

    const widthRatio = bounds.width / width;
    const heightRatio = bounds.height / height;
    const bottom = bounds.top + bounds.height;
    const bottomRatio = bottom / height;
    if (widthRatio < 0.42 || heightRatio < 0.2) continue;
    if (bounds.top < height * 0.14 && bottomRatio < 0.78) continue;

    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    const horizontalCenterBias = 1 - Math.abs(centerX - width / 2) / (width / 2);
    const lowerHalfBias = centerY >= height * 0.58 ? 1.2 : centerY >= height * 0.45 ? 0.9 : 0.35;
    const bottomBias = bottomRatio >= 0.92 ? 1.35 : bottomRatio >= 0.8 ? 1.05 : 0.6;
    const score =
      bboxArea / totalPixels +
      fillRatio * 0.8 +
      widthRatio * 1.2 +
      horizontalCenterBias * 0.35 +
      lowerHalfBias +
      bottomBias;

    if (score > bestScore) {
      bestScore = score;
      bestBounds = bounds;
    }
  }

  return bestBounds;
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
      const top = Math.max(0, lineBounds.top - verticalPadding);
      const bottom = Math.min(height, lineBounds.top + lineBounds.height + verticalPadding);
      const detectedMarkerLeft = findLineMarkerLeftEdge(
        data,
        width,
        height,
        channels,
        lineBounds,
        top,
        bottom,
      );
      const left = Math.max(0, (detectedMarkerLeft ?? lineBounds.left) - horizontalPadding);
      const right = Math.min(width, lineBounds.left + lineBounds.width + horizontalPadding);

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

function findLineMarkerLeftEdge(
  data: Uint8Array,
  width: number,
  height: number,
  channels: number,
  lineBounds: CropBounds,
  top: number,
  bottom: number,
): number | null {
  const searchLeft = Math.max(0, lineBounds.left - HANDWRITING_LINE_MARKER_LOOKBACK_PX);
  const searchRight = Math.min(
    width - 1,
    lineBounds.left + Math.max(4, Math.round(lineBounds.width * 0.06)),
  );
  const yStart = Math.max(0, top);
  const yEnd = Math.min(height, bottom);
  let earliestInkX: number | null = null;

  for (let x = searchLeft; x <= searchRight; x += 1) {
    let inkPixels = 0;

    for (let y = yStart; y < yEnd; y += 1) {
      const offset = (y * width + x) * channels;
      if (getMarkerInkMaskPixel(data, offset)) {
        inkPixels += 1;
      }
    }

    if (inkPixels >= 3) {
      earliestInkX = x;
      break;
    }
  }

  return earliestInkX;
}

function getLineClusterBounds(lines: CropBounds[]): CropBounds | null {
  if (!lines.length) return null;

  const lineWidths = [...lines].map((line) => line.width).sort((left, right) => left - right);
  const medianWidth = lineWidths[Math.floor(lineWidths.length / 2)] ?? 1;
  const sortedLines = [...lines]
    .filter((line) => line.width <= medianWidth * 1.9 || line.height >= 18)
    .sort((left, right) => left.top - right.top);
  if (!sortedLines.length) return null;

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
      const score = cluster.length * 1400 + inkLikeArea + bounds.width * 2 - bounds.height * 3;
      return { bounds, score };
    })
    .sort((left, right) => right.score - left.score)[0];

  return bestCluster?.bounds ?? null;
}

function findContiguousThresholdSegment(
  values: number[],
  seedIndex: number,
  minimumValue: number,
): { start: number; end: number } | null {
  if (!values.length) return null;
  const clampedSeedIndex = Math.max(0, Math.min(values.length - 1, seedIndex));
  let seed = clampedSeedIndex;

  if ((values[seed] ?? 0) < minimumValue) {
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < values.length; index += 1) {
      if ((values[index] ?? 0) < minimumValue) continue;
      const distance = Math.abs(index - clampedSeedIndex);
      if (distance >= bestDistance) continue;
      bestDistance = distance;
      seed = index;
    }
    if (!Number.isFinite(bestDistance)) return null;
  }

  let start = seed;
  let end = seed;
  while (start > 0 && (values[start - 1] ?? 0) >= minimumValue) start -= 1;
  while (end < values.length - 1 && (values[end + 1] ?? 0) >= minimumValue) end += 1;

  return { start, end };
}

async function refineHandwritingRegionToCardboardEdges(
  input: InputImage,
  handwritingRegion: CropBounds,
  handwritingLineRegions: CropBounds[],
): Promise<CropBounds | null> {
  const lineClusterBounds = getLineClusterBounds(handwritingLineRegions);
  if (!lineClusterBounds) return null;

  const baseImage = sharp(input.buffer, { animated: true, failOn: 'none', pages: 1 })
    .rotate()
    .flatten({ background: '#ffffff' });
  const metadata = await baseImage.metadata();
  if (!metadata.width || !metadata.height) return null;

  const searchRegion = expandBounds(
    unionBounds([handwritingRegion, lineClusterBounds]),
    metadata.width,
    metadata.height,
    0.18,
    24,
  );
  const { data, info } = await baseImage
    .extract(searchRegion)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const localLineBounds = offsetBounds(lineClusterBounds, {
    left: -searchRegion.left,
    top: -searchRegion.top,
  });
  const xStart = Math.max(0, Math.floor(localLineBounds.left));
  const xEnd = Math.min(info.width, Math.ceil(localLineBounds.left + localLineBounds.width));
  const yStart = Math.max(0, Math.floor(localLineBounds.top));
  const yEnd = Math.min(info.height, Math.ceil(localLineBounds.top + localLineBounds.height));
  if (xEnd <= xStart || yEnd <= yStart) return null;

  const rowRatios = Array.from({ length: info.height }, (_, y) => {
    let cardboardPixels = 0;
    for (let x = xStart; x < xEnd; x += 1) {
      if (getCardboardMaskPixel(data, (y * info.width + x) * info.channels)) {
        cardboardPixels += 1;
      }
    }
    return cardboardPixels / Math.max(1, xEnd - xStart);
  });
  const rowSegment = findContiguousThresholdSegment(
    rowRatios,
    Math.round(localLineBounds.top + localLineBounds.height / 2),
    0.42,
  );
  if (!rowSegment) return null;

  const columnRatios = Array.from({ length: info.width }, (_, x) => {
    let cardboardPixels = 0;
    for (let y = rowSegment.start; y <= rowSegment.end; y += 1) {
      if (getCardboardMaskPixel(data, (y * info.width + x) * info.channels)) {
        cardboardPixels += 1;
      }
    }
    return cardboardPixels / Math.max(1, rowSegment.end - rowSegment.start + 1);
  });
  const columnSegment = findContiguousThresholdSegment(
    columnRatios,
    Math.round(localLineBounds.left + localLineBounds.width / 2),
    0.38,
  );
  if (!columnSegment) return null;

  const refinedLocalBounds = {
    left: columnSegment.start,
    top: rowSegment.start,
    width: columnSegment.end - columnSegment.start + 1,
    height: rowSegment.end - rowSegment.start + 1,
  };
  const refinedBounds = expandBounds(
    offsetBounds(refinedLocalBounds, {
      left: searchRegion.left,
      top: searchRegion.top,
    }),
    metadata.width,
    metadata.height,
    0.015,
    6,
  );

  const lineIntersection = intersectBounds(refinedBounds, lineClusterBounds);
  const lineArea = lineClusterBounds.width * lineClusterBounds.height;
  const intersectionArea = lineIntersection ? lineIntersection.width * lineIntersection.height : 0;
  const lineFallbackBounds = expandBounds(
    lineClusterBounds,
    metadata.width,
    metadata.height,
    0.075,
    14,
  );
  if (intersectionArea < lineArea * 0.92) return lineFallbackBounds;

  const refinedArea = refinedBounds.width * refinedBounds.height;
  const fallbackArea = lineFallbackBounds.width * lineFallbackBounds.height;
  if (refinedArea > fallbackArea * 2.4) return lineFallbackBounds;

  return refinedBounds;
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

async function detectCardboardBoxRegion(
  input: InputImage,
  timings?: Partial<OcrDebugTimings>,
): Promise<CropBounds | null> {
  const detectionStartedAt = Date.now();
  try {
    const detrBounds = await detectCardboardBoxRegionWithDetr(input, timings);
    if (detrBounds) return detrBounds;
  } catch {
    // Fall back to the color-based heuristic when the detector is unavailable or weak.
  } finally {
    if (timings) timings.boxDetectionMs = Date.now() - detectionStartedAt;
  }

  const baseImage = sharp(input.buffer, { animated: true, failOn: 'none', pages: 1 })
    .rotate()
    .flatten({ background: '#ffffff' });
  const metadata = await baseImage.metadata();

  if (!metadata.width || !metadata.height) return null;

  const { data, info } = await baseImage
    .resize({
      width: CARDBOARD_DETECTION_MAX_DIMENSION,
      height: CARDBOARD_DETECTION_MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const detectedBounds = findLikelyCardboardRegion(data, info.width, info.height, info.channels);
  if (!detectedBounds) return null;

  const scaled = scaleBounds(
    detectedBounds,
    metadata.width / info.width,
    metadata.height / info.height,
    metadata.width,
    metadata.height,
  );

  return expandBounds(scaled, metadata.width, metadata.height, 0.02, 12);
}

async function detectHandwritingRegion(
  input: InputImage,
  labelRegion: LabelDetection | null,
  boxRegion: CropBounds | null,
): Promise<CropBounds | null> {
  const baseImage = sharp(input.buffer, { animated: true, failOn: 'none', pages: 1 })
    .rotate()
    .flatten({ background: '#ffffff' });
  const metadata = await baseImage.metadata();

  if (!metadata.width || !metadata.height) return null;

  const searchRegion = boxRegion ?? {
    left: 0,
    top: 0,
    width: metadata.width,
    height: metadata.height,
  };

  const { data, info } = await baseImage
    .extract(searchRegion)
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
    searchRegion.width / info.width,
    searchRegion.height / info.height,
    searchRegion.width,
    searchRegion.height,
  );
  const initialRegionInImage = offsetBounds(initialRegion, searchRegion);
  const handwritingLineRegions = await detectHandwritingLineRegions(
    input,
    expandBounds(initialRegionInImage, metadata.width, metadata.height, 0.04),
  );
  const lineClusterBounds = getLineClusterBounds(handwritingLineRegions);
  if (lineClusterBounds) {
    return expandBounds(lineClusterBounds, metadata.width, metadata.height, 0.035, 8);
  }

  const scaled = scaleBounds(
    detectedBounds,
    searchRegion.width / info.width,
    searchRegion.height / info.height,
    searchRegion.width,
    searchRegion.height,
  );

  return expandBounds(offsetBounds(scaled, searchRegion), metadata.width, metadata.height, 0.04);
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

type OcrRunResult = OcrResult & {
  modelId: string;
  source: OcrSource;
  textRegion: CropBounds | null;
  tokenLineRegions: CropBounds[];
  textLines: OcrTextLine[];
};

type PaddleOcrRunResult = OcrRunResult;

type OcrSpaceWord = {
  Left?: unknown;
  Top?: unknown;
  Width?: unknown;
  Height?: unknown;
  WordText?: unknown;
};

type OcrSpaceLine = {
  Words?: unknown;
  LineText?: unknown;
};

type OcrSpaceParsedResult = {
  ParsedText?: unknown;
  TextOverlay?: unknown;
  ErrorMessage?: unknown;
  ErrorDetails?: unknown;
};

type OcrSpacePayload = {
  ParsedResults?: unknown;
  IsErroredOnProcessing?: unknown;
  ErrorMessage?: unknown;
  ErrorDetails?: unknown;
};

type PreparedOcrInput = {
  buffer: Buffer;
  cropOrigin: { left: number; top: number };
  contentType: string;
  fileName: string;
};

function createSavedOcrInputPath(prefix: 'paddle' | 'ocrspace', extension: string) {
  fs.mkdirSync(tempDir, { recursive: true });
  return path.join(tempDir, `${randomUUID()}-${prefix}-input.${extension}`);
}

function clearSavedOcrInputFiles() {
  fs.mkdirSync(tempDir, { recursive: true });

  for (const entry of fs.readdirSync(tempDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (!/(?:^|-)ocrspace-input\.|(?:^|-)paddle-input\./i.test(entry.name)) continue;

    fs.unlinkSync(path.join(tempDir, entry.name));
  }
}

function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
}

function appendErrorText(parts: string[], value: unknown) {
  if (typeof value === 'string' && value.trim()) {
    parts.push(value.trim());
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) appendErrorText(parts, item);
  }
}

function getOcrSpaceErrorMessage(payload: OcrSpacePayload | OcrSpaceParsedResult) {
  const parts: string[] = [];
  appendErrorText(parts, payload.ErrorMessage);
  appendErrorText(parts, payload.ErrorDetails);
  return parts.join(' ');
}

function parseOcrSpaceLineRegions(
  lines: unknown,
  cropOrigin: { left: number; top: number },
): CropBounds[] {
  if (!Array.isArray(lines)) return [];

  return lines.flatMap((line) => {
    if (!line || typeof line !== 'object') return [];

    const words = (line as OcrSpaceLine).Words;
    if (!Array.isArray(words)) return [];

    const regions = words.flatMap((word) => {
      if (!word || typeof word !== 'object') return [];

      const { Left, Top, Width, Height } = word as OcrSpaceWord;
      const left = Number(Left);
      const top = Number(Top);
      const width = Number(Width);
      const height = Number(Height);
      if (![left, top, width, height].every(Number.isFinite)) return [];
      if (width <= 0 || height <= 0) return [];

      return [
        {
          left: Math.round(cropOrigin.left + left),
          top: Math.round(cropOrigin.top + top),
          width: Math.round(width),
          height: Math.round(height),
        },
      ];
    });

    return regions.length ? [unionBounds(regions)] : [];
  });
}

function parseOcrSpaceTextLines(
  lines: unknown,
  cropOrigin: { left: number; top: number },
): OcrTextLine[] {
  if (!Array.isArray(lines)) return [];

  return lines.flatMap((line) => {
    if (!line || typeof line !== 'object') return [];

    const words = (line as OcrSpaceLine).Words;
    if (!Array.isArray(words)) return [];

    const textFromLine =
      typeof (line as OcrSpaceLine).LineText === 'string'
        ? normalizeOcrText((line as OcrSpaceLine).LineText as string)
        : '';
    const wordEntries = words.flatMap((word) => {
      if (!word || typeof word !== 'object') return [];

      const { Left, Top, Width, Height, WordText } = word as OcrSpaceWord;
      const left = Number(Left);
      const top = Number(Top);
      const width = Number(Width);
      const height = Number(Height);
      if (![left, top, width, height].every(Number.isFinite)) return [];
      if (width <= 0 || height <= 0) return [];

      return [
        {
          text: typeof WordText === 'string' ? WordText.trim() : '',
          bounds: {
            left: Math.round(cropOrigin.left + left),
            top: Math.round(cropOrigin.top + top),
            width: Math.round(width),
            height: Math.round(height),
          },
        },
      ];
    });

    if (!wordEntries.length) return [];

    return [
      {
        text: textFromLine || normalizeOcrText(wordEntries.map((entry) => entry.text).join(' ')),
        bounds: unionBounds(wordEntries.map((entry) => entry.bounds)),
        words: wordEntries,
      },
    ];
  });
}

async function prepareOcrInput(
  input: InputImage,
  labelRegion: LabelDetection | null,
  handwritingRegion: CropBounds | null,
  handwritingLineRegions: CropBounds[],
): Promise<PreparedOcrInput> {
  const tightHandwritingRegion = handwritingLineRegions.length
    ? padBoundsWithinRegionAsymmetric(
        unionBounds(handwritingLineRegions),
        handwritingRegion ?? unionBounds(handwritingLineRegions),
        { left: OCR_SPACE_LEFT_PADDING_PX, top: 4, right: 4, bottom: 4 },
      )
    : handwritingRegion;
  const workingRegion = tightHandwritingRegion ?? {
    left: 0,
    top: 0,
    width: Number.MAX_SAFE_INTEGER,
    height: Number.MAX_SAFE_INTEGER,
  };
  let image = sharp(input.buffer, { animated: true, failOn: 'none', pages: 1 })
    .rotate()
    .flatten({ background: '#ffffff' });

  const cropOrigin = tightHandwritingRegion
    ? { left: tightHandwritingRegion.left, top: tightHandwritingRegion.top }
    : { left: 0, top: 0 };

  if (tightHandwritingRegion) {
    image = image.extract(tightHandwritingRegion);
  }

  if (labelRegion) {
    const clippedLabelBounds = intersectBounds(labelRegion.bounds, workingRegion);
    if (clippedLabelBounds) {
      const paddedLabelBounds = padBoundsWithinRegion(
        clippedLabelBounds,
        workingRegion,
        LABEL_MASK_PADDING_PX,
      );
      const labelMaskInput = await sharp(labelRegion.mask)
        .extract({
          left: clippedLabelBounds.left,
          top: clippedLabelBounds.top,
          width: clippedLabelBounds.width,
          height: clippedLabelBounds.height,
        })
        .resize({
          width: paddedLabelBounds.width,
          height: paddedLabelBounds.height,
          fit: 'fill',
          kernel: sharp.kernel.nearest,
        })
        .png()
        .toBuffer();

      image = image.composite([
        {
          input: labelMaskInput,
          left: paddedLabelBounds.left - cropOrigin.left,
          top: paddedLabelBounds.top - cropOrigin.top,
        },
      ]);
    }
  }

  return {
    buffer: await image.png().toBuffer(),
    cropOrigin,
    contentType: 'image/png',
    fileName: 'ocr-input.png',
  };
}

async function extractRegionBuffer(input: InputImage, region: CropBounds): Promise<Buffer> {
  return sharp(input.buffer, { animated: true, failOn: 'none', pages: 1 })
    .rotate()
    .flatten({ background: '#ffffff' })
    .extract(region)
    .png()
    .toBuffer();
}

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

type PaddleTokenText = {
  text: string;
  bounds: CropBounds;
};

function parsePaddleTokenTexts(tokens: unknown): PaddleTokenText[] {
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
        text:
          typeof (token as { text?: unknown }).text === 'string'
            ? (token as { text: string }).text.trim()
            : '',
        bounds: {
          left: Math.round(left),
          top: Math.round(top),
          width: Math.round(right - left),
          height: Math.round(bottom - top),
        },
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

function groupPaddleTextLines(tokens: PaddleTokenText[]): OcrTextLine[] {
  const lines: { top: number; height: number; tokens: PaddleTokenText[] }[] = [];

  for (const token of [...tokens].sort((left, right) => left.bounds.top - right.bounds.top)) {
    const line = lines.find((candidateLine) => {
      const maxTopDistance = Math.max(18, candidateLine.height * 0.35);
      return Math.abs(token.bounds.top - candidateLine.top) <= maxTopDistance;
    });

    if (line) {
      line.tokens.push(token);
      const tops = line.tokens.map((lineToken) => lineToken.bounds.top);
      line.top = tops.reduce((total, top) => total + top, 0) / tops.length;
      line.height = Math.max(...line.tokens.map((lineToken) => lineToken.bounds.height));
    } else {
      lines.push({ top: token.bounds.top, height: token.bounds.height, tokens: [token] });
    }
  }

  return lines
    .map((line) => {
      const sortedTokens = [...line.tokens].sort(
        (left, right) => left.bounds.left - right.bounds.left,
      );
      return {
        text: normalizeOcrText(sortedTokens.map((token) => token.text).join(' ')),
        bounds: unionBounds(sortedTokens.map((token) => token.bounds)),
        words: sortedTokens,
      };
    })
    .filter((line) => line.text)
    .sort((left, right) => left.bounds.top - right.bounds.top);
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

  const inputPath = createSavedOcrInputPath('paddle', 'png');
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
    const textLines = groupPaddleTextLines(parsePaddleTokenTexts(payload.tokens)).map((line) => ({
      ...line,
      bounds: expandBounds(line.bounds, metadata.width ?? 1, metadata.height ?? 1, 0.025, 4),
    }));
    const tokenLineRegions = groupPaddleTokenLineRegions(tokenRegions).map((region) =>
      expandBounds(region, metadata.width ?? 1, metadata.height ?? 1, 0.025, 4),
    );
    const textRegion = tokenLineRegions.length
      ? expandBounds(unionBounds(tokenLineRegions), metadata.width, metadata.height, 0.025, 6)
      : null;

    return {
      text,
      confidence: Number.isFinite(confidence) ? confidence * 100 : 0,
      trackingNumber: '',
      modelId: PADDLE_OCR_MODEL_ID,
      source: 'paddleocr',
      textRegion,
      tokenLineRegions,
      textLines,
    };
  } catch (error) {
    const message = getExecErrorMessage(error);
    throw new Error(
      `PaddleOCR failed. ${message} Install local OCR deps with "pnpm --dir apps/image_processor run install:ocr".`,
    );
  }
}

async function runOcrSpace(
  input: InputImage,
  labelRegion: LabelDetection | null,
  handwritingRegion: CropBounds | null,
  handwritingLineRegions: CropBounds[],
  ocrEngine = OCR_SPACE_ENGINE,
): Promise<OcrRunResult | null> {
  if (!shouldTryOcrSpace() || !OCR_SPACE_API_KEY) return null;

  const metadata = await sharp(input.buffer, { animated: true, failOn: 'none', pages: 1 })
    .rotate()
    .metadata();
  if (!metadata.width || !metadata.height) return null;

  const preparedInput = await prepareOcrInput(
    input,
    labelRegion,
    handwritingRegion,
    handwritingLineRegions,
  );
  const ocrSpaceInputPath = createSavedOcrInputPath('ocrspace', 'png');
  fs.writeFileSync(ocrSpaceInputPath, preparedInput.buffer);
  const formData = new FormData();
  formData.set('apikey', OCR_SPACE_API_KEY);
  formData.set('language', getOcrSpaceLanguage(ocrEngine));
  formData.set('isOverlayRequired', 'true');
  formData.set('OCREngine', ocrEngine);
  formData.set('filetype', 'PNG');
  formData.set('scale', 'true');
  formData.set(
    'file',
    new Blob([bufferToArrayBuffer(preparedInput.buffer)], { type: preparedInput.contentType }),
    preparedInput.fileName,
  );

  const response = await fetch(OCR_SPACE_API_URL, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(getOcrTimeoutMs()),
  });

  if (!response.ok) {
    throw new Error(`ocr.space request failed with ${response.status} ${response.statusText}.`);
  }

  const payload = (await response.json()) as OcrSpacePayload;
  if (payload.IsErroredOnProcessing === true) {
    const apiError = getOcrSpaceErrorMessage(payload);
    throw new Error(apiError || 'ocr.space reported an OCR processing error.');
  }

  const parsedResults = Array.isArray(payload.ParsedResults) ? payload.ParsedResults : [];
  const textParts: string[] = [];
  const lineRegions: CropBounds[] = [];
  const textLines: OcrTextLine[] = [];

  for (const parsedResult of parsedResults) {
    if (!parsedResult || typeof parsedResult !== 'object') continue;

    const typedResult = parsedResult as OcrSpaceParsedResult;
    const parsedText =
      typeof typedResult.ParsedText === 'string' ? normalizeOcrText(typedResult.ParsedText) : '';
    if (parsedText) textParts.push(parsedText);

    if (typedResult.ErrorMessage || typedResult.ErrorDetails) {
      const apiError = getOcrSpaceErrorMessage(typedResult);
      if (apiError) console.warn(`ocr.space result warning: ${apiError}`);
    }

    const overlay = typedResult.TextOverlay;
    if (overlay && typeof overlay === 'object' && 'Lines' in overlay) {
      textLines.push(
        ...parseOcrSpaceTextLines((overlay as { Lines?: unknown }).Lines, preparedInput.cropOrigin),
      );
      lineRegions.push(
        ...parseOcrSpaceLineRegions(
          (overlay as { Lines?: unknown }).Lines,
          preparedInput.cropOrigin,
        ),
      );
    }
  }

  const text = normalizeOcrText(textParts.join('\n\n'));
  if (!text) return null;

  const tokenLineRegions = lineRegions.map((region) =>
    expandBounds(region, metadata.width ?? 1, metadata.height ?? 1, 0.025, 4),
  );
  const textRegion = tokenLineRegions.length
    ? expandBounds(unionBounds(tokenLineRegions), metadata.width, metadata.height, 0.025, 6)
    : handwritingRegion;

  return {
    text,
    confidence: 0,
    trackingNumber: '',
    modelId: `ocr.space-engine-${ocrEngine}`,
    source: 'ocrspace',
    textRegion,
    tokenLineRegions,
    textLines,
  };
}

async function extractTrackingNumberFromLabelRegion(
  input: InputImage,
  labelRegion: LabelDetection | null,
  timings?: Partial<OcrDebugTimings>,
): Promise<TrackingLineMatch> {
  const startedAt = Date.now();
  const finishTrackingMatch = (match: TrackingLineMatch) => {
    if (timings) timings.trackingDetectionMs = Date.now() - startedAt;
    return match;
  };

  if (!labelRegion) return finishTrackingMatch({ trackingNumber: '', lineRegion: null });
  const labelBounds = labelRegion.bounds;

  const labelInput: InputImage = {
    buffer: await extractRegionBuffer(input, labelBounds),
    filename: 'label-region.png',
    mimeType: 'image/png',
  };

  async function runPaddleTrackingFallback(
    preferredTrackingNumber = '',
  ): Promise<TrackingLineMatch> {
    const paddleStartedAt = Date.now();
    const paddleResult = await runPaddleOcr(labelInput, null, null);
    if (timings) timings.trackingPaddleMs = Date.now() - paddleStartedAt;

    const paddleTrackingMatch = extractTrackingMatchFromTextLines(
      paddleResult?.textLines ?? [],
      paddleResult?.text ?? '',
    );
    const normalizedPreferredTrackingNumber = normalizeTrackingCandidate(preferredTrackingNumber);

    if (
      normalizedPreferredTrackingNumber &&
      paddleTrackingMatch?.trackingNumber &&
      normalizeTrackingCandidate(paddleTrackingMatch.trackingNumber) ===
        normalizedPreferredTrackingNumber
    ) {
      return {
        trackingNumber: preferredTrackingNumber,
        lineRegion: paddleTrackingMatch.lineRegion
          ? offsetBounds(paddleTrackingMatch.lineRegion, {
              left: labelBounds.left,
              top: labelBounds.top,
            })
          : null,
      };
    }

    if (normalizedPreferredTrackingNumber && paddleResult?.textLines?.length) {
      for (const line of paddleResult.textLines ?? []) {
        const normalizedLine = normalizeTrackingCandidate(line.text);
        if (!normalizedLine.includes(normalizedPreferredTrackingNumber)) continue;
        const lineRegion = findTrackingCandidateBounds(line, normalizedPreferredTrackingNumber);

        return {
          trackingNumber: preferredTrackingNumber,
          lineRegion: lineRegion
            ? offsetBounds(lineRegion, {
                left: labelBounds.left,
                top: labelBounds.top,
              })
            : null,
        };
      }
    }

    if (paddleTrackingMatch?.trackingNumber) {
      return {
        trackingNumber: preferredTrackingNumber || paddleTrackingMatch.trackingNumber,
        lineRegion: paddleTrackingMatch.lineRegion
          ? offsetBounds(paddleTrackingMatch.lineRegion, {
              left: labelBounds.left,
              top: labelBounds.top,
            })
          : null,
      };
    }

    return {
      trackingNumber:
        preferredTrackingNumber || extractTrackingNumberFromText(paddleResult?.text ?? ''),
      lineRegion: null,
    };
  }

  try {
    const ocrSpaceStartedAt = Date.now();
    const ocrSpaceResult = await runOcrSpace(labelInput, null, null, [], '2');
    if (timings) timings.trackingOcrSpaceMs = Date.now() - ocrSpaceStartedAt;
    const trackingMatch = extractTrackingMatchFromTextLines(
      ocrSpaceResult?.textLines ?? [],
      ocrSpaceResult?.text ?? '',
    );
    if (trackingMatch?.trackingNumber) {
      return finishTrackingMatch({
        trackingNumber: trackingMatch.trackingNumber,
        lineRegion: trackingMatch.lineRegion
          ? offsetBounds(trackingMatch.lineRegion, {
              left: labelBounds.left,
              top: labelBounds.top,
            })
          : null,
      });
    }

    const trackingNumber = extractTrackingNumberFromText(ocrSpaceResult?.text ?? '');
    if (trackingNumber) {
      try {
        return finishTrackingMatch(await runPaddleTrackingFallback(trackingNumber));
      } catch {
        return finishTrackingMatch({ trackingNumber, lineRegion: null });
      }
    }
  } catch {
    // Ignore label OCR provider failures and continue to local OCR fallback.
  }

  try {
    return finishTrackingMatch(await runPaddleTrackingFallback());
  } catch {
    return finishTrackingMatch({ trackingNumber: '', lineRegion: null });
  }
}

function buildDebugResult(
  runResult: OcrRunResult,
  cardboardBoxRegion: CropBounds | null,
  labelRegion: LabelDetection | null,
  trackingLineRegion: CropBounds | null,
  handwritingRegion: CropBounds | null,
  fallbackLineRegions: CropBounds[],
  trackingNumber: string,
  timings: OcrDebugTimings,
): OcrDebugResult {
  const selectedRegion = runResult.textRegion || handwritingRegion;
  const usesProviderLineRegions = runResult.tokenLineRegions.length > 0;
  const selectedLineRegions = usesProviderLineRegions
    ? runResult.tokenLineRegions
    : fallbackLineRegions;
  const selectedOcrResult = {
    text: runResult.text,
    confidence: runResult.confidence,
    trackingNumber,
  };

  return {
    modelId: runResult.modelId,
    detectedCardboardBoxRegion: cardboardBoxRegion,
    detectedLabelRegion: labelRegion?.bounds || null,
    detectedLabelMask: labelRegion?.mask || null,
    detectedTrackingLineRegion: trackingLineRegion,
    detectedHandwritingRegion: handwritingRegion,
    detectedHandwritingLineRegions: selectedLineRegions,
    lineRegionSource: usesProviderLineRegions ? 'provider' : 'heuristic',
    selectedSource: runResult.source,
    selectedRegion,
    selectedResult: selectedOcrResult,
    labelRegionResult: null,
    handwritingRegionResult: selectedOcrResult,
    fullImageResult: selectedOcrResult,
    timings,
  };
}

export async function extractTextFromImageDebug(input: InputImage): Promise<OcrDebugResult> {
  const totalStartedAt = Date.now();
  const timings: OcrDebugTimings = {
    totalMs: 0,
  };
  clearSavedOcrInputFiles();
  const cardboardBoxRegion = await detectCardboardBoxRegion(input, timings);
  const labelStartedAt = Date.now();
  const labelRegion = await detectShippingLabelRegion(input);
  timings.labelDetectionMs = Date.now() - labelStartedAt;
  const trackingMatch = await extractTrackingNumberFromLabelRegion(input, labelRegion, timings);
  const handwritingStartedAt = Date.now();
  let handwritingRegion = await detectHandwritingRegion(input, labelRegion, cardboardBoxRegion);
  timings.handwritingDetectionMs = Date.now() - handwritingStartedAt;
  const handwritingLinesStartedAt = Date.now();
  let handwritingLineRegions = handwritingRegion
    ? await detectHandwritingLineRegions(input, handwritingRegion)
    : [];
  if (handwritingRegion && handwritingLineRegions.length) {
    const refinedHandwritingRegion = await refineHandwritingRegionToCardboardEdges(
      input,
      handwritingRegion,
      handwritingLineRegions,
    );
    if (refinedHandwritingRegion) {
      handwritingRegion = refinedHandwritingRegion;
      handwritingLineRegions = await detectHandwritingLineRegions(input, handwritingRegion);
    }
  }
  timings.handwritingLineDetectionMs = Date.now() - handwritingLinesStartedAt;
  try {
    const ocrSpaceStartedAt = Date.now();
    const ocrSpaceResult = await runOcrSpace(
      input,
      labelRegion,
      handwritingRegion,
      handwritingLineRegions,
    );
    timings.mainOcrSpaceMs = Date.now() - ocrSpaceStartedAt;
    if (ocrSpaceResult?.text) {
      timings.totalMs = Date.now() - totalStartedAt;
      return buildDebugResult(
        ocrSpaceResult,
        cardboardBoxRegion,
        labelRegion,
        trackingMatch.lineRegion,
        handwritingRegion,
        handwritingLineRegions,
        trackingMatch.trackingNumber,
        timings,
      );
    }
  } catch (error) {
    console.warn(`ocr.space failed, falling back to PaddleOCR: ${getExecErrorMessage(error)}`);
  }

  const paddleStartedAt = Date.now();
  const paddleOcrResult = await runPaddleOcr(input, handwritingRegion, labelRegion?.bounds || null);
  timings.mainPaddleMs = Date.now() - paddleStartedAt;
  if (paddleOcrResult?.text) {
    timings.totalMs = Date.now() - totalStartedAt;
    return buildDebugResult(
      paddleOcrResult,
      cardboardBoxRegion,
      labelRegion,
      trackingMatch.lineRegion,
      handwritingRegion,
      handwritingLineRegions,
      trackingMatch.trackingNumber,
      timings,
    );
  }

  throw new Error(
    `OCR did not return text. Configure OCRSPACE_API_KEY for cloud OCR or install local OCR deps with "pnpm --dir apps/image_processor run install:ocr" and check the detected handwriting region.`,
  );
}

export async function extractTextFromImage(input: InputImage): Promise<OcrResult> {
  const debugResult = await extractTextFromImageDebug(input);
  return debugResult.selectedResult;
}

function getDebugOverlaySvg(width: number, height: number, debugResult: OcrDebugResult) {
  const elements: string[] = [];
  const lineRegionStroke = debugResult.lineRegionSource === 'provider' ? '#f97316' : '#a855f7';
  const lineRegionLabel = debugResult.lineRegionSource === 'provider' ? 'provider' : 'heuristic';
  const timingRows = buildDebugTimingRows(debugResult.timings);

  if (debugResult.detectedCardboardBoxRegion) {
    const region = debugResult.detectedCardboardBoxRegion;
    elements.push(
      `<rect x="${region.left}" y="${region.top}" width="${region.width}" height="${region.height}" fill="none" stroke="#22c55e" stroke-width="6" stroke-dasharray="22 12" />`,
    );
  }

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

  if (debugResult.detectedTrackingLineRegion) {
    const region = debugResult.detectedTrackingLineRegion;
    elements.push(
      `<rect x="${region.left}" y="${region.top}" width="${region.width}" height="${region.height}" fill="rgba(37, 99, 235, 0.16)" stroke="#2563eb" stroke-width="4" stroke-dasharray="16 8" />`,
    );
  }

  for (const region of debugResult.detectedHandwritingLineRegions) {
    elements.push(
      `<rect x="${region.left}" y="${region.top}" width="${region.width}" height="${region.height}" fill="none" stroke="${lineRegionStroke}" stroke-width="4" stroke-dasharray="10 8" />`,
    );
  }

  if (debugResult.selectedRegion) {
    const region = debugResult.selectedRegion;
    elements.push(
      `<rect x="${region.left}" y="${region.top}" width="${region.width}" height="${region.height}" fill="rgba(16, 185, 129, 0.12)" stroke="#10b981" stroke-width="10" />`,
    );
  }

  const statusText = `selected=${debugResult.selectedSource} model=${debugResult.modelId} lines=${lineRegionLabel}`;
  const tableTop = 50;
  const rowHeight = 22;
  const bannerHeight = Math.min(
    Math.round(height * 0.45),
    Math.max(92, tableTop + rowHeight * (timingRows.length + 2) + 10),
  );
  const durationColumnX = Math.min(Math.max(260, Math.round(width * 0.28)), width - 280);
  const totalColumnX = Math.min(
    Math.max(durationColumnX + 170, Math.round(width * 0.44)),
    width - 140,
  );
  elements.push(
    `<rect x="0" y="0" width="${width}" height="${bannerHeight}" fill="rgba(0,0,0,0.58)" />`,
  );
  elements.push(
    `<text x="24" y="30" fill="#ffffff" font-size="24" font-family="Arial, sans-serif">${escapeXml(statusText)}</text>`,
  );
  elements.push(
    `<line x1="24" y1="${tableTop - 14}" x2="${Math.min(width - 24, totalColumnX + 132)}" y2="${tableTop - 14}" stroke="rgba(255,255,255,0.28)" stroke-width="1" />`,
  );
  const headerY = tableTop + 2;
  elements.push(
    `<text x="24" y="${headerY}" fill="#bfdbfe" font-size="16" font-weight="700" font-family="Arial, sans-serif">operation</text>`,
    `<text x="${durationColumnX}" y="${headerY}" fill="#bfdbfe" font-size="16" font-weight="700" font-family="Arial, sans-serif">duration</text>`,
    `<text x="${totalColumnX}" y="${headerY}" fill="#bfdbfe" font-size="16" font-weight="700" font-family="Arial, sans-serif">running total</text>`,
  );
  elements.push(
    `<line x1="24" y1="${tableTop + 10}" x2="${Math.min(width - 24, totalColumnX + 132)}" y2="${tableTop + 10}" stroke="rgba(255,255,255,0.22)" stroke-width="1" />`,
  );
  timingRows.forEach((row, index) => {
    const y = tableTop + 32 + index * rowHeight;
    elements.push(
      `<text x="24" y="${y}" fill="#ffffff" font-size="16" font-family="Arial, sans-serif">${escapeXml(row.operation)}</text>`,
      `<text x="${durationColumnX}" y="${y}" fill="#ffffff" font-size="16" font-family="Arial, sans-serif">${escapeXml(formatTimingMs(row.durationMs) ?? '')}</text>`,
      `<text x="${totalColumnX}" y="${y}" fill="#ffffff" font-size="16" font-family="Arial, sans-serif">${escapeXml(formatTimingMs(row.runningTotalMs) ?? '')}</text>`,
    );
  });
  const totalY = tableTop + 32 + timingRows.length * rowHeight;
  elements.push(
    `<line x1="24" y1="${totalY - 14}" x2="${Math.min(width - 24, totalColumnX + 132)}" y2="${totalY - 14}" stroke="rgba(255,255,255,0.22)" stroke-width="1" />`,
    `<text x="24" y="${totalY}" fill="#bfdbfe" font-size="16" font-weight="700" font-family="Arial, sans-serif">total processing</text>`,
    `<text x="${totalColumnX}" y="${totalY}" fill="#bfdbfe" font-size="16" font-weight="700" font-family="Arial, sans-serif">${escapeXml(formatTimingMs(debugResult.timings.totalMs) ?? '')}</text>`,
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

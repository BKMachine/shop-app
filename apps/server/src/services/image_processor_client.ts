import fs from 'node:fs';
import path from 'node:path';

export type BackgroundRemovalBackend = 'birefnet' | 'imgly' | 'rembg';
export type BackgroundRemovalModel = 'small' | 'medium' | 'large';

type ProcessedImageResponse = {
  buffer: Buffer;
  mimeType: string;
  extension: string;
};

type BinaryResponse = {
  buffer: Buffer;
  mimeType: string;
};

type OcrResponse = {
  text: string;
  confidence: number;
};

type ImageProcessorErrorPayload = {
  error?: unknown;
  code?: unknown;
};

type ImageProcessorRequestFieldValue = string | undefined;

export class ImageProcessorClientError extends Error {
  statusCode: number;

  code?: string;

  constructor(statusCode: number, message: string, options?: ErrorOptions & { code?: string }) {
    super(message, options);
    this.name = 'ImageProcessorClientError';
    this.statusCode = statusCode;
    this.code = options?.code;
  }
}

function getImageProcessorBaseUrl() {
  return process.env.IMAGE_PROCESSOR_URL?.trim() || 'http://127.0.0.1:3101';
}

function getMimeTypeForSourcePath(sourcePath: string): string {
  const ext = path.extname(sourcePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'application/octet-stream';
}

function getExtensionForMimeType(mimeType: string): string {
  const normalizedMimeType = mimeType.trim().toLowerCase().split(';')[0] ?? '';
  if (normalizedMimeType === 'image/jpeg') return '.jpg';
  if (normalizedMimeType === 'image/png') return '.png';
  if (normalizedMimeType === 'image/webp') return '.webp';
  return '.bin';
}

async function parseErrorResponse(response: Response): Promise<ImageProcessorClientError> {
  let payload: ImageProcessorErrorPayload | null = null;

  try {
    payload = (await response.json()) as ImageProcessorErrorPayload;
  } catch {
    payload = null;
  }

  const message =
    typeof payload?.error === 'string' && payload.error
      ? payload.error
      : `Image processor request failed with status ${response.status}`;
  const code = typeof payload?.code === 'string' && payload.code ? payload.code : undefined;

  return new ImageProcessorClientError(response.status, message, { code });
}

async function callImageProcessor(
  route: string,
  sourcePath: string,
  fields: Record<string, ImageProcessorRequestFieldValue> = {},
): Promise<ProcessedImageResponse> {
  const form = new FormData();
  const filename = path.basename(sourcePath);
  const mimeType = getMimeTypeForSourcePath(sourcePath);
  const sourceBuffer = fs.readFileSync(sourcePath);

  form.append('image', new Blob([sourceBuffer], { type: mimeType }), filename);

  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === 'string' && value) {
      form.append(key, value);
    }
  }

  let response: Response;

  try {
    response = await fetch(`${getImageProcessorBaseUrl()}/api/process/${route}`, {
      method: 'POST',
      body: form,
    });
  } catch (error) {
    throw new ImageProcessorClientError(503, 'Image processor unavailable', { cause: error });
  }

  if (!response.ok) {
    throw await parseErrorResponse(response);
  }

  const responseMimeType = response.headers.get('content-type') || 'application/octet-stream';
  const buffer = Buffer.from(await response.arrayBuffer());

  return {
    buffer,
    mimeType: responseMimeType,
    extension: getExtensionForMimeType(responseMimeType),
  };
}

async function callImageProcessorMultipartJson<T>(
  route: string,
  sourcePath: string,
  fields: Record<string, ImageProcessorRequestFieldValue> = {},
): Promise<T> {
  const form = new FormData();
  const filename = path.basename(sourcePath);
  const mimeType = getMimeTypeForSourcePath(sourcePath);
  const sourceBuffer = fs.readFileSync(sourcePath);

  form.append('image', new Blob([sourceBuffer], { type: mimeType }), filename);

  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === 'string' && value) {
      form.append(key, value);
    }
  }

  let response: Response;

  try {
    response = await fetch(`${getImageProcessorBaseUrl()}/api/process/${route}`, {
      method: 'POST',
      body: form,
    });
  } catch (error) {
    throw new ImageProcessorClientError(503, 'Image processor unavailable', { cause: error });
  }

  if (!response.ok) {
    throw await parseErrorResponse(response);
  }

  return (await response.json()) as T;
}

async function callImageProcessorJson(route: string, payload: unknown): Promise<BinaryResponse> {
  let response: Response;

  try {
    response = await fetch(`${getImageProcessorBaseUrl()}/api/${route}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw new ImageProcessorClientError(503, 'Image processor unavailable', { cause: error });
  }

  if (!response.ok) {
    throw await parseErrorResponse(response);
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    mimeType: response.headers.get('content-type') || 'application/octet-stream',
  };
}

export function isSkippableAutoAlignError(error: unknown): boolean {
  return (
    error instanceof ImageProcessorClientError &&
    (error.code === 'already_aligned' || error.message.includes('already aligned closely enough'))
  );
}

export async function removeImageBackground(
  sourcePath: string,
  options: {
    backend?: BackgroundRemovalBackend | null;
    model?: BackgroundRemovalModel | null;
  } = {},
) {
  return callImageProcessor('remove-background', sourcePath, {
    backend: options.backend ?? undefined,
    model: options.model ?? undefined,
  });
}

export async function autoCropImage(sourcePath: string) {
  return callImageProcessor('auto-crop', sourcePath);
}

export async function autoAlignImage(sourcePath: string) {
  return callImageProcessor('auto-align', sourcePath);
}

export async function rotateImage(sourcePath: string, degrees: 90 | -90) {
  return callImageProcessor('rotate', sourcePath, {
    direction: degrees === 90 ? 'cw' : 'ccw',
  });
}

export async function processImageStack(
  sourcePath: string,
  stage: 1 | 2 | 3,
  options: {
    backend?: BackgroundRemovalBackend | null;
    model?: BackgroundRemovalModel | null;
  } = {},
) {
  return callImageProcessor('process-stack', sourcePath, {
    stage: String(stage),
    backend: options.backend ?? undefined,
    model: options.model ?? undefined,
  });
}

export async function ocrImage(sourcePath: string) {
  return callImageProcessorMultipartJson<OcrResponse>('ocr', sourcePath);
}

export async function ocrImageDebugOverlay(sourcePath: string) {
  return callImageProcessor('ocr/debug?format=image', sourcePath);
}

export async function buildLocationLabel(data: PrintLocationBody) {
  return callImageProcessorJson('labels/location', data);
}

export async function buildItemLabel(data: PrintItemBody) {
  return callImageProcessorJson('labels/item', data);
}

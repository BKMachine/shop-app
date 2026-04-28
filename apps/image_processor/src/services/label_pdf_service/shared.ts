import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PDFFont } from 'pdf-lib';
import QRCode from 'qrcode';
import sharp from 'sharp';
import logger from '../../logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const POINTS_PER_INCH = 72;

export const ADDRESS_LABEL = {
  width: 3.5 * POINTS_PER_INCH,
  height: 1.125 * POINTS_PER_INCH,
};

export type AddressLabelData = PrintItemBody & { barcode?: string };
export type PartPositionLabelData = PrintPartPositionBody;

export function resolveAssetPath(...segments: string[]) {
  const candidates = [
    path.join(__dirname, '../../../../assets', ...segments),
    path.join(__dirname, '../../../assets', ...segments),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Missing asset: ${path.join(...segments)}`);
}

export const segoeUiRegularPath = resolveAssetPath('fonts', 'Segoe UI', 'Segoe UI.ttf');
export const bkLogoPath = resolveAssetPath('images', 'bk_logo.png');

export async function buildGrayscaleLogoBuffer(width: number, height: number) {
  return sharp(fs.readFileSync(bkLogoPath))
    .trim()
    .grayscale()
    .resize(Math.round(width * 4), Math.round(height * 4), {
      fit: 'contain',
      withoutEnlargement: true,
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .png()
    .toBuffer();
}

export async function buildQrCodeWithCenteredLogoBuffer(value: string, size: number) {
  const qrBuffer = await QRCode.toBuffer(value, {
    errorCorrectionLevel: 'H',
    margin: 0,
    width: size,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
    type: 'png',
  });

  const logoSize = Math.max(1, Math.round(size * 0.22));
  const plateSize = Math.max(logoSize + 12, Math.round(size * 0.29));
  const plateOffset = Math.round((size - plateSize) / 2);
  const logoOffset = Math.round((size - logoSize) / 2);
  const cornerRadius = Math.max(6, Math.round(plateSize * 0.18));

  const plateSvg = Buffer.from(
    `<svg width="${plateSize}" height="${plateSize}" viewBox="0 0 ${plateSize} ${plateSize}" xmlns="http://www.w3.org/2000/svg"><rect width="${plateSize}" height="${plateSize}" rx="${cornerRadius}" ry="${cornerRadius}" fill="#FFFFFF"/></svg>`,
  );

  const logoBuffer = await sharp(fs.readFileSync(bkLogoPath))
    .trim()
    .grayscale()
    .resize(logoSize, logoSize, {
      fit: 'contain',
      withoutEnlargement: true,
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .png()
    .toBuffer();

  return sharp(qrBuffer)
    .composite([
      { input: plateSvg, left: plateOffset, top: plateOffset },
      { input: logoBuffer, left: logoOffset, top: logoOffset },
    ])
    .png()
    .toBuffer();
}

function buildMissingImageSvg(width: number, height: number) {
  const stroke = Math.max(4, Math.round(Math.min(width, height) * 0.05));
  const radius = Math.max(10, Math.round(Math.min(width, height) * 0.08));
  const sunRadius = Math.max(8, Math.round(Math.min(width, height) * 0.09));
  return Buffer.from(
    `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="${width - 4}" height="${height - 4}" rx="${radius}" ry="${radius}" fill="#F4F4F4" stroke="#8A8A8A" stroke-width="${stroke}"/>
      <circle cx="${Math.round(width * 0.72)}" cy="${Math.round(height * 0.28)}" r="${sunRadius}" fill="#B8B8B8"/>
      <path d="M ${Math.round(width * 0.18)} ${Math.round(height * 0.74)} L ${Math.round(width * 0.38)} ${Math.round(height * 0.5)} L ${Math.round(width * 0.53)} ${Math.round(height * 0.64)} L ${Math.round(width * 0.68)} ${Math.round(height * 0.42)} L ${Math.round(width * 0.84)} ${Math.round(height * 0.74)} Z" fill="#C8C8C8" stroke="#8A8A8A" stroke-width="${Math.max(2, Math.round(stroke * 0.55))}" stroke-linejoin="round"/>
      <path d="M ${Math.round(width * 0.22)} ${Math.round(height * 0.22)} L ${Math.round(width * 0.78)} ${Math.round(height * 0.78)}" stroke="#777777" stroke-width="${stroke}" stroke-linecap="round"/>
    </svg>`,
  );
}

export async function buildPartImageOrFallbackBuffer(
  imageUrl: string | undefined,
  width: number,
  height: number,
) {
  const targetWidth = Math.max(1, Math.round(width * 4));
  const targetHeight = Math.max(1, Math.round(height * 4));

  if (imageUrl) {
    let parsedUrl: URL | null = null;

    try {
      parsedUrl = new URL(imageUrl);
    } catch {
      parsedUrl = null;
    }

    try {
      const response = await fetch(imageUrl);
      if (response.ok) {
        const imageBuffer = Buffer.from(await response.arrayBuffer());
        return sharp(imageBuffer)
          .grayscale()
          .resize(targetWidth, targetHeight, {
            fit: 'contain',
            withoutEnlargement: true,
            background: { r: 255, g: 255, b: 255, alpha: 0 },
          })
          .png()
          .toBuffer();
      }

      logger.error(
        `Label image fetch returned non-OK response. url=${imageUrl} status=${response.status} statusText=${response.statusText} contentType=${response.headers.get('content-type') || 'unknown'}`,
      );
      if (parsedUrl) {
        logger.error(
          `Label image fetch URL details. protocol=${parsedUrl.protocol} host=${parsedUrl.host} hostname=${parsedUrl.hostname} port=${parsedUrl.port || '(default)'} pathname=${parsedUrl.pathname}`,
        );
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const cause =
        err.cause instanceof Error
          ? `${err.cause.name}: ${err.cause.message}`
          : err.cause != null
            ? String(err.cause)
            : 'none';

      logger.error(
        `Label image fetch failed. url=${imageUrl} errorName=${err.name} errorMessage=${err.message} cause=${cause}`,
      );
      if (parsedUrl) {
        logger.error(
          `Label image fetch URL details. protocol=${parsedUrl.protocol} host=${parsedUrl.host} hostname=${parsedUrl.hostname} port=${parsedUrl.port || '(default)'} pathname=${parsedUrl.pathname}`,
        );
      }
      if (err.stack) {
        logger.error(`Label image fetch stack: ${err.stack}`);
      }
    }
  }

  return sharp({
    create: {
      width: targetWidth,
      height: targetHeight,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    },
  })
    .composite([{ input: buildMissingImageSvg(targetWidth, targetHeight), left: 0, top: 0 }])
    .png()
    .toBuffer();
}

export function fitText(
  font: PDFFont,
  text: string,
  maxWidth: number,
  startSize: number,
  minSize = 8,
) {
  let size = startSize;
  while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 0.5;
  }
  return size;
}

export function fitTextToBox(
  font: PDFFont,
  text: string,
  maxWidth: number,
  maxHeight: number,
  startSize: number,
  minSize = 8,
) {
  let size = fitText(font, text, maxWidth, startSize, minSize);

  while (size > minSize && font.heightAtSize(size) > maxHeight) {
    size -= 0.5;
  }

  return size;
}

export function sanitize(text?: string) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

export function inches(value: number) {
  return value * POINTS_PER_INCH;
}

export function toPdfY(pageHeight: number, topInches: number, heightInches = 0) {
  return pageHeight - inches(topInches + heightInches);
}

export function dataUrlToBuffer(dataUrl: string) {
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  return Buffer.from(base64, 'base64');
}

export function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

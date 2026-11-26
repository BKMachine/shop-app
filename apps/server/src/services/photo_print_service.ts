import { PDFDocument, type PDFFont, type PDFImage, rgb, StandardFonts } from 'pdf-lib';

/**
 * Lays a photo out on one letter page for printing: the image is scaled to fit
 * the page (portrait or landscape, whichever matches the photo), with an optional
 * caption across the top and the capture time in the bottom-right corner.
 */

const POINTS_PER_INCH = 72;
const LETTER_SHORT = 8.5 * POINTS_PER_INCH;
const LETTER_LONG = 11 * POINTS_PER_INCH;
const MARGIN = 0.4 * POINTS_PER_INCH;
const CAPTION_SIZE = 16;
const CAPTION_LINE_HEIGHT = 20;
const CAPTION_MAX_LINES = 2;
const TIMESTAMP_SIZE = 10;
const GAP = 8;

export const MAX_CAPTION_LENGTH = 200;
export const MAX_TIMESTAMP_LENGTH = 40;

export class UnsupportedImageError extends Error {}

export type PhotoPrintInput = {
  image: Uint8Array;
  caption?: string;
  /** Already formatted in the device's local time, e.g. "2026-11-26 3:42 PM". */
  timestamp: string;
};

export type PhotoPageLayout = {
  landscape: boolean;
  pageWidth: number;
  pageHeight: number;
  image: { x: number; y: number; width: number; height: number };
  captionLines: string[];
};

function isJpeg(bytes: Uint8Array) {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isPng(bytes: Uint8Array) {
  return (
    bytes.length > 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  );
}

/** The standard PDF fonts only cover Latin-1; swap anything else for '?'. */
export function toPrintableText(value: string) {
  return value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[^\x20-\x7e\xa0-\xff]/g, '?')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Word-wraps text to the width, ending the last allowed line with "..." if it runs over. */
export function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
  maxLines: number,
) {
  const words = text.split(' ').filter(Boolean);
  const lines: string[] = [];
  let current = '';

  const fits = (value: string) => font.widthOfTextAtSize(value, size) <= maxWidth;

  for (let index = 0; index < words.length; index++) {
    const word = words[index] as string;
    const candidate = current ? `${current} ${word}` : word;
    if (fits(candidate)) {
      current = candidate;
      continue;
    }

    if (current) lines.push(current);
    current = word;

    if (lines.length === maxLines) {
      current = '';
      break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);

  const usedWords = lines.join(' ').split(' ').filter(Boolean).length;
  const truncated = usedWords < words.length;

  return lines.map((line, index) => {
    const isLast = index === lines.length - 1;
    if (fits(line) && !(isLast && truncated)) return line;

    let shortened = line;
    while (shortened.length > 1 && !fits(`${shortened}...`)) {
      shortened = shortened.slice(0, -1);
    }
    return `${shortened.trimEnd()}...`;
  });
}

export function layoutPhotoPage(
  imageWidth: number,
  imageHeight: number,
  captionLines: string[],
): PhotoPageLayout {
  const landscape = imageWidth > imageHeight;
  const pageWidth = landscape ? LETTER_LONG : LETTER_SHORT;
  const pageHeight = landscape ? LETTER_SHORT : LETTER_LONG;

  const captionHeight = captionLines.length ? captionLines.length * CAPTION_LINE_HEIGHT + GAP : 0;
  const footerHeight = TIMESTAMP_SIZE + GAP;

  const areaX = MARGIN;
  const areaY = MARGIN + footerHeight;
  const areaWidth = pageWidth - 2 * MARGIN;
  const areaHeight = pageHeight - 2 * MARGIN - footerHeight - captionHeight;

  const scale = Math.min(areaWidth / imageWidth, areaHeight / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;

  return {
    landscape,
    pageWidth,
    pageHeight,
    image: {
      x: areaX + (areaWidth - width) / 2,
      y: areaY + (areaHeight - height) / 2,
      width,
      height,
    },
    captionLines,
  };
}

export async function buildPhotoPdf(input: PhotoPrintInput): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.setTitle('Shop App photo');
  document.setProducer('shop-app');

  let image: PDFImage;
  if (isJpeg(input.image)) {
    image = await document.embedJpg(input.image);
  } else if (isPng(input.image)) {
    image = await document.embedPng(input.image);
  } else {
    throw new UnsupportedImageError('Only JPEG and PNG images can be printed.');
  }

  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const regular = await document.embedFont(StandardFonts.Helvetica);

  const caption = toPrintableText(input.caption ?? '').slice(0, MAX_CAPTION_LENGTH);
  const timestamp = toPrintableText(input.timestamp).slice(0, MAX_TIMESTAMP_LENGTH);

  const landscape = image.width > image.height;
  const textWidth = (landscape ? LETTER_LONG : LETTER_SHORT) - 2 * MARGIN;
  const captionLines = caption
    ? wrapText(caption, bold, CAPTION_SIZE, textWidth, CAPTION_MAX_LINES)
    : [];

  const layout = layoutPhotoPage(image.width, image.height, captionLines);
  const page = document.addPage([layout.pageWidth, layout.pageHeight]);
  const black = rgb(0, 0, 0);

  layout.captionLines.forEach((line, index) => {
    const lineWidth = bold.widthOfTextAtSize(line, CAPTION_SIZE);
    page.drawText(line, {
      x: (layout.pageWidth - lineWidth) / 2,
      y: layout.pageHeight - MARGIN - CAPTION_SIZE - index * CAPTION_LINE_HEIGHT,
      size: CAPTION_SIZE,
      font: bold,
      color: black,
    });
  });

  page.drawImage(image, layout.image);

  if (timestamp) {
    page.drawText(timestamp, {
      x: layout.pageWidth - MARGIN - regular.widthOfTextAtSize(timestamp, TIMESTAMP_SIZE),
      y: MARGIN,
      size: TIMESTAMP_SIZE,
      font: regular,
      color: rgb(0.2, 0.2, 0.2),
    });
  }

  return document.save();
}

import fs from 'node:fs';
import fontkit from '@pdf-lib/fontkit';
import { degrees, PDFDocument, type PDFFont, rgb } from 'pdf-lib';
import QRCode from 'qrcode';
import {
  dataUrlToBuffer,
  fitText,
  inches,
  POINTS_PER_INCH,
  sanitize,
  segoeUiRegularPath,
  toPdfY,
} from './shared.js';

const LOCATION_LABEL = {
  width: 1.0 * POINTS_PER_INCH,
  height: 1.0 * POINTS_PER_INCH,
};

export interface LocationTextLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
}

export interface LocationQrLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LocationLabelLayout {
  text: LocationTextLayout;
  qr: LocationQrLayout;
}

export const DEFAULT_LOCATION_LABEL_LAYOUT: LocationLabelLayout = {
  text: {
    x: 0.105,
    y: 0.09270832,
    width: 0.5988035,
    height: 0.2850005,
    fontSize: 14.3,
  },
  qr: {
    x: 0.642,
    y: 0.095,
    width: 0.299,
    height: 0.299,
  },
};

const LOCATION_SLOT = {
  width: 0.5 * POINTS_PER_INCH,
  height: LOCATION_LABEL.height,
};

function cloneLocationLabelLayout(layout: LocationLabelLayout): LocationLabelLayout {
  return {
    text: { ...layout.text },
    qr: { ...layout.qr },
  };
}

export function getDefaultLocationLabelLayout() {
  return cloneLocationLabelLayout(DEFAULT_LOCATION_LABEL_LAYOUT);
}

function getLocationTextPlacement(font: PDFFont, position: string, layout: LocationLabelLayout) {
  const textWidth = inches(layout.text.width);
  const textHeight = inches(layout.text.height);
  const fontSize = fitText(font, position, textWidth, layout.text.fontSize, 8);
  const textX = inches(layout.text.x);
  const textHeightAtSize = font.heightAtSize(fontSize);
  const textBaselineAdjust = 3.1;
  const textY =
    toPdfY(LOCATION_LABEL.height, layout.text.y, layout.text.height) +
    (textHeight - textHeightAtSize) / 2 +
    textBaselineAdjust;

  return {
    fontSize,
    textX,
    textY,
  };
}

async function buildLocationLabelImage(data: PrintLocationBody, layout: LocationLabelLayout) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const page = pdf.addPage([LOCATION_LABEL.width, LOCATION_LABEL.height]);
  const sans = await pdf.embedFont(fs.readFileSync(segoeUiRegularPath));

  const position = sanitize(data.pos);
  const qrPayload = `Loc:${sanitize(data.loc)} | ${position}`;
  const qrPngDataUrl = await QRCode.toDataURL(qrPayload, {
    errorCorrectionLevel: 'M',
    margin: 0,
    width: 1024,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
  });

  const qrImage = await pdf.embedPng(dataUrlToBuffer(qrPngDataUrl));

  for (const slotIndex of [0, 1] as const) {
    const textPlacement = getLocationTextPlacement(sans, position, layout);
    const slotLeft = slotIndex * LOCATION_SLOT.width;
    const textBaselineYTop = LOCATION_SLOT.height - textPlacement.textY;
    const rotatedTextX = slotLeft + LOCATION_SLOT.width - textBaselineYTop;
    const rotatedTextYTop = textPlacement.textX;
    const qrXTop = slotLeft + LOCATION_SLOT.width - inches(layout.qr.y) - inches(layout.qr.height);
    const qrYTop = inches(layout.qr.x);
    const qrWidth = inches(layout.qr.width);
    const qrHeight = inches(layout.qr.height);

    page.drawText(position, {
      x: rotatedTextX,
      y: LOCATION_LABEL.height - rotatedTextYTop,
      size: textPlacement.fontSize,
      font: sans,
      color: rgb(0, 0, 0),
      rotate: degrees(-90),
    });

    page.drawImage(qrImage, {
      x: qrXTop,
      y: LOCATION_LABEL.height - qrYTop,
      width: qrWidth,
      height: qrHeight,
      rotate: degrees(-90),
    });
  }

  return Buffer.from(await pdf.save());
}

export async function buildLocationLabel(
  data: PrintLocationBody,
  layout: LocationLabelLayout = DEFAULT_LOCATION_LABEL_LAYOUT,
) {
  return buildLocationLabelImage(data, layout);
}

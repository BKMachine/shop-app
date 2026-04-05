import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, type PDFFont, rgb } from 'pdf-lib';
import QRCode from 'qrcode';
import sharp from 'sharp';

const POINTS_PER_INCH = 72;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
type ItemLabelData = PrintItemBody & { barcode?: string };

function resolveAssetPath(...segments: string[]) {
  const candidates = [
    path.join(__dirname, '../../assets', ...segments),
    path.join(__dirname, '../assets', ...segments),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Missing asset: ${path.join(...segments)}`);
}

const segoeUiRegularPath = resolveAssetPath('fonts', 'Segoe UI', 'Segoe UI.ttf');
const bkLogoPath = resolveAssetPath('images', 'bk_logo.png');

const LOCATION_LABEL = {
  width: 1.0 * POINTS_PER_INCH,
  height: 1.0 * POINTS_PER_INCH,
};

const LOCATION_SLOT_HEIGHT_INCHES = 0.5;
const LOCATION_OBJECTS = {
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
const LOCATION_TEXT_LAYOUT = {
  x: LOCATION_OBJECTS.text.x,
  y: LOCATION_OBJECTS.text.y,
  width: LOCATION_OBJECTS.text.width,
  height: LOCATION_OBJECTS.text.height,
  fontSize: LOCATION_OBJECTS.text.fontSize,
};
const LOCATION_QR_LAYOUT = {
  x: LOCATION_OBJECTS.qr.x,
  y: LOCATION_OBJECTS.qr.y,
  width: LOCATION_OBJECTS.qr.width,
  height: LOCATION_OBJECTS.qr.height,
};

const ITEM_LABEL = {
  width: 3.5 * POINTS_PER_INCH,
  height: 1.125 * POINTS_PER_INCH,
};

const ITEM_LAYOUT = {
  description: {
    x: 0.2430209,
    y: 0.06,
    width: 3.1,
    height: 0.31,
    fontSize: 16,
    minFontSize: 5,
  },
  logo: {
    x: 0.23,
    y: 0.5,
    width: 0.53,
    height: 0.58,
  },
  brand: {
    x: 1.23,
    y: 0.55,
    width: 1.18,
    height: 0.28,
    fontSize: 30,
    minFontSize: 12,
  },
  code: {
    x: 2.84,
    y: 0.49,
    width: 0.49,
    height: 0.49,
  },
};

const LOCATION_TOP_PREVIEW = {
  width: 400,
  height: 203,
  background: '#c9c9c9',
  labelX: 6,
  labelY: 9,
  labelWidth: 385,
  labelHeight: 193,
  labelRadius: 40,
};
const LOCATION_LABEL_RASTER_SIZE = 900;

function fitText(font: PDFFont, text: string, maxWidth: number, startSize: number, minSize = 8) {
  let size = startSize;
  while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 0.5;
  }
  return size;
}

function fitTextToBox(
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

function sanitize(text?: string) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function inches(value: number) {
  return value * POINTS_PER_INCH;
}

function toPdfY(pageHeight: number, topInches: number, heightInches = 0) {
  return pageHeight - inches(topInches + heightInches);
}

function dataUrlToBuffer(dataUrl: string) {
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  return Buffer.from(base64, 'base64');
}

function getLocationTextPlacement(font: PDFFont, position: string, slotTop = 0) {
  const textWidth = inches(LOCATION_TEXT_LAYOUT.width);
  const textHeight = inches(LOCATION_TEXT_LAYOUT.height);
  const fontSize = fitText(font, position, textWidth, LOCATION_TEXT_LAYOUT.fontSize, 8);
  const textX = inches(LOCATION_TEXT_LAYOUT.x);
  const textHeightAtSize = font.heightAtSize(fontSize);
  const textBaselineAdjust = 3.1;
  const textY =
    toPdfY(LOCATION_LABEL.height, slotTop + LOCATION_TEXT_LAYOUT.y, LOCATION_TEXT_LAYOUT.height) +
    (textHeight - textHeightAtSize) / 2 +
    textBaselineAdjust;

  return {
    fontSize,
    textX,
    textY,
  };
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

async function buildLocationLabel(data: PrintLocationBody) {
  const labelImageBuffer = await buildLocationLabelImage(data);
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([LOCATION_LABEL.width, LOCATION_LABEL.height]);
  const labelImage = await pdf.embedPng(labelImageBuffer);

  page.drawImage(labelImage, {
    x: 0,
    y: 0,
    width: LOCATION_LABEL.width,
    height: LOCATION_LABEL.height,
  });

  return Buffer.from(await pdf.save());
}

async function buildLocationLabelTopPreviewPng(data: PrintLocationBody) {
  const labelImage = await sharp(
    await buildLocationLabelImage(data, LOCATION_TOP_PREVIEW.labelWidth * 3),
  )
    .resize(LOCATION_TOP_PREVIEW.labelWidth, LOCATION_TOP_PREVIEW.labelHeight, {
      fit: 'fill',
      kernel: 'nearest',
    })
    .png()
    .toBuffer();

  const svg = Buffer.from(
    `<svg width="${LOCATION_TOP_PREVIEW.width}" height="${LOCATION_TOP_PREVIEW.height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${LOCATION_TOP_PREVIEW.background}" />
      <rect
        x="${LOCATION_TOP_PREVIEW.labelX}"
        y="${LOCATION_TOP_PREVIEW.labelY}"
        width="${LOCATION_TOP_PREVIEW.labelWidth}"
        height="${LOCATION_TOP_PREVIEW.labelHeight}"
        rx="${LOCATION_TOP_PREVIEW.labelRadius}"
        ry="${LOCATION_TOP_PREVIEW.labelRadius}"
        fill="#ffffff"
      />
    </svg>`,
  );

  return sharp(svg)
    .composite([
      {
        input: labelImage,
        left: LOCATION_TOP_PREVIEW.labelX,
        top: LOCATION_TOP_PREVIEW.labelY,
      },
    ])
    .png()
    .toBuffer();
}

async function buildLocationLabelImage(data: PrintLocationBody, size = LOCATION_LABEL_RASTER_SIZE) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const sans = await pdf.embedFont(fs.readFileSync(segoeUiRegularPath));

  const position = sanitize(data.pos);
  const qrPayload = `Loc:${sanitize(data.loc)} | ${position}`;
  const embeddedSegoeUi = fs.readFileSync(segoeUiRegularPath).toString('base64');
  const scale = size / LOCATION_LABEL.width;
  const qrPngDataUrl = await QRCode.toDataURL(qrPayload, {
    errorCorrectionLevel: 'M',
    margin: 0,
    width: 1024,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
  });

  const slotHeightPx = inches(LOCATION_SLOT_HEIGHT_INCHES) * scale;
  const columnWidthPx = slotHeightPx;
  const qrDataUrl = `data:image/png;base64,${dataUrlToBuffer(qrPngDataUrl).toString('base64')}`;

  const slotGroups = [0, 1]
    .map((slotIndex) => {
      const textPlacement = getLocationTextPlacement(sans, position);
      const textX = textPlacement.textX * scale;
      const textBaselineY = slotHeightPx - textPlacement.textY * scale;
      const textFontPx = textPlacement.fontSize * scale;
      const qrX = inches(LOCATION_QR_LAYOUT.x) * scale;
      const qrY = inches(LOCATION_QR_LAYOUT.y) * scale;
      const qrSize = inches(LOCATION_QR_LAYOUT.width) * scale;
      const columnLeft = slotIndex * columnWidthPx;

      return `<g transform="translate(${columnLeft + columnWidthPx} 0) rotate(90)">
        <text x="${textX}" y="${textBaselineY}" font-family="'PreviewSegoeUI'" font-size="${textFontPx}" fill="#000000">${escapeXml(position)}</text>
        <image href="${qrDataUrl}" x="${qrX}" y="${qrY}" width="${qrSize}" height="${qrSize}" preserveAspectRatio="none" />
      </g>`;
    })
    .join('');

  const svg = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <style>
        @font-face {
          font-family: 'PreviewSegoeUI';
          src: url(data:font/ttf;base64,${embeddedSegoeUi}) format('truetype');
        }
      </style>
      <rect width="100%" height="100%" fill="#ffffff" />
      ${slotGroups}
    </svg>`,
  );

  return sharp(svg).png().toBuffer();
}

async function buildItemLabel(data: ItemLabelData) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const page = pdf.addPage([ITEM_LABEL.width, ITEM_LABEL.height]);
  const sans = await pdf.embedFont(fs.readFileSync(segoeUiRegularPath));

  const description = sanitize(data.description);
  const item = sanitize(data.item);
  const brand = sanitize(data.brand);
  const squareCodeValue = sanitize(data.barcode) || item;

  const descriptionWidth = inches(ITEM_LAYOUT.description.width);
  const descriptionHeight = inches(ITEM_LAYOUT.description.height);
  const descriptionX = inches(ITEM_LAYOUT.description.x);
  const descriptionY = toPdfY(
    ITEM_LABEL.height,
    ITEM_LAYOUT.description.y,
    ITEM_LAYOUT.description.height,
  );
  const descriptionSize = fitTextToBox(
    sans,
    description,
    descriptionWidth,
    descriptionHeight - 2,
    ITEM_LAYOUT.description.fontSize,
    ITEM_LAYOUT.description.minFontSize,
  );
  const descriptionTextWidth = sans.widthOfTextAtSize(description, descriptionSize);
  const descriptionTextHeight = sans.heightAtSize(descriptionSize);

  page.drawText(description, {
    x: descriptionX + Math.max(0, (descriptionWidth - descriptionTextWidth) / 2),
    y: descriptionY + (descriptionHeight - descriptionTextHeight) / 2 + 1,
    size: descriptionSize,
    font: sans,
    color: rgb(0, 0, 0),
  });

  const logoBuffer = await sharp(fs.readFileSync(bkLogoPath))
    .trim()
    .resize(
      Math.round(inches(ITEM_LAYOUT.logo.width) * 4),
      Math.round(inches(ITEM_LAYOUT.logo.height) * 4),
      {
        fit: 'contain',
        withoutEnlargement: true,
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      },
    )
    .png()
    .toBuffer();
  const logoImage = await pdf.embedPng(logoBuffer);
  page.drawImage(logoImage, {
    x: inches(ITEM_LAYOUT.logo.x),
    y: toPdfY(ITEM_LABEL.height, ITEM_LAYOUT.logo.y, ITEM_LAYOUT.logo.height),
    width: inches(ITEM_LAYOUT.logo.width),
    height: inches(ITEM_LAYOUT.logo.height),
  });

  const brandWidth = inches(ITEM_LAYOUT.brand.width);
  const brandHeight = inches(ITEM_LAYOUT.brand.height);
  const brandX = inches(ITEM_LAYOUT.brand.x);
  const brandY = toPdfY(ITEM_LABEL.height, ITEM_LAYOUT.brand.y, ITEM_LAYOUT.brand.height);

  if (brand) {
    const brandSize = fitTextToBox(
      sans,
      brand,
      brandWidth,
      brandHeight,
      ITEM_LAYOUT.brand.fontSize,
      ITEM_LAYOUT.brand.minFontSize,
    );
    const brandTextWidth = sans.widthOfTextAtSize(brand, brandSize);
    const brandTextHeight = sans.heightAtSize(brandSize);
    page.drawText(brand, {
      x: brandX + Math.max(0, (brandWidth - brandTextWidth) / 2),
      y: brandY + (brandHeight - brandTextHeight) / 2 + 1,
      size: brandSize,
      font: sans,
      color: rgb(0, 0, 0),
    });
  }

  const codePngDataUrl = await QRCode.toDataURL(squareCodeValue, {
    errorCorrectionLevel: 'M',
    margin: 0,
    width: 512,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
  });
  const codeImage = await pdf.embedPng(dataUrlToBuffer(codePngDataUrl));
  page.drawImage(codeImage, {
    x: inches(ITEM_LAYOUT.code.x),
    y: toPdfY(ITEM_LABEL.height, ITEM_LAYOUT.code.y, ITEM_LAYOUT.code.height),
    width: inches(ITEM_LAYOUT.code.width),
    height: inches(ITEM_LAYOUT.code.height),
  });

  return Buffer.from(await pdf.save());
}

export default {
  buildLocationLabel,
  buildLocationLabelTopPreviewPng,
  buildItemLabel,
};

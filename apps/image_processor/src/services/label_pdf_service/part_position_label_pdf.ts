import fs from 'node:fs';
import fontkit from '@pdf-lib/fontkit';
import { degrees, PDFDocument, rgb } from 'pdf-lib';
import {
  ADDRESS_LABEL,
  buildPartImageOrFallbackBuffer,
  buildQrCodeWithCenteredLogoBuffer,
  fitTextToBox,
  inches,
  type PartPositionLabelData,
  sanitize,
  segoeUiRegularPath,
  toPdfY,
} from './shared.js';

const PART_POSITION_LAYOUT = {
  description: {
    x: 0.18,
    y: 0.08,
    width: 3.14,
    height: 0.24,
    fontSize: 13,
    minFontSize: 5,
  },
  logo: {
    x: 0.18,
    y: 0.39,
    width: 0.56,
    height: 0.56,
  },
  part: {
    x: 0.92,
    y: 0.43,
    width: 1.66,
    height: 0.18,
    fontSize: 18,
    minFontSize: 8,
  },
  location: {
    x: 0.92,
    y: 0.68,
    width: 1.66,
    height: 0.18,
    fontSize: 14,
    minFontSize: 8,
  },
  code: {
    x: 2.76,
    y: 0.39,
    width: 0.56,
    height: 0.56,
  },
};

const ROTATED_ADDRESS_LABEL = {
  width: ADDRESS_LABEL.height,
  height: ADDRESS_LABEL.width,
};

function getCenteredTextPlacement(
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
  text: string,
  layout: {
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize: number;
    minFontSize: number;
  },
) {
  const boxWidth = inches(layout.width);
  const boxHeight = inches(layout.height);
  const fontSize = fitTextToBox(
    font,
    text,
    boxWidth,
    boxHeight,
    layout.fontSize,
    layout.minFontSize,
  );
  const textWidth = font.widthOfTextAtSize(text, fontSize);
  const textHeight = font.heightAtSize(fontSize);
  const baselineAdjust = 1;

  return {
    fontSize,
    x: inches(layout.x) + Math.max(0, (boxWidth - textWidth) / 2),
    y:
      toPdfY(ADDRESS_LABEL.height, layout.y, layout.height) +
      (boxHeight - textHeight) / 2 +
      baselineAdjust,
  };
}

function rotateClockwisePoint(x: number, y: number) {
  return {
    x: y,
    y: ADDRESS_LABEL.width - x,
  };
}

export async function buildPartPositionLabel(data: PartPositionLabelData) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const page = pdf.addPage([ROTATED_ADDRESS_LABEL.width, ROTATED_ADDRESS_LABEL.height]);
  const sans = await pdf.embedFont(fs.readFileSync(segoeUiRegularPath));

  const description = sanitize(data.description);
  const part = sanitize(data.part);
  const location = `${sanitize(data.loc)} | ${sanitize(data.pos)}`;
  const qrValue = `bk-part:${sanitize(data.partId)}`;
  const logoWidth = inches(PART_POSITION_LAYOUT.logo.width);
  const logoHeight = inches(PART_POSITION_LAYOUT.logo.height);
  const codeWidth = inches(PART_POSITION_LAYOUT.code.width);
  const codeHeight = inches(PART_POSITION_LAYOUT.code.height);

  const descriptionPlacement = getCenteredTextPlacement(
    sans,
    description,
    PART_POSITION_LAYOUT.description,
  );
  const rotatedDescriptionPlacement = rotateClockwisePoint(
    descriptionPlacement.x,
    descriptionPlacement.y,
  );

  page.drawText(description, {
    x: rotatedDescriptionPlacement.x,
    y: rotatedDescriptionPlacement.y,
    size: descriptionPlacement.fontSize,
    font: sans,
    color: rgb(0, 0, 0),
    rotate: degrees(-90),
  });

  const logoBuffer = await buildPartImageOrFallbackBuffer(data.partImageUrl, logoWidth, logoHeight);
  const logoImage = await pdf.embedPng(logoBuffer);
  const logoPlacement = rotateClockwisePoint(
    inches(PART_POSITION_LAYOUT.logo.x),
    toPdfY(ADDRESS_LABEL.height, PART_POSITION_LAYOUT.logo.y, PART_POSITION_LAYOUT.logo.height),
  );
  page.drawImage(logoImage, {
    x: logoPlacement.x,
    y: logoPlacement.y,
    width: logoWidth,
    height: logoHeight,
    rotate: degrees(-90),
  });

  const partPlacement = getCenteredTextPlacement(sans, part, PART_POSITION_LAYOUT.part);
  const rotatedPartPlacement = rotateClockwisePoint(partPlacement.x, partPlacement.y);
  page.drawText(part, {
    x: rotatedPartPlacement.x,
    y: rotatedPartPlacement.y,
    size: partPlacement.fontSize,
    font: sans,
    color: rgb(0, 0, 0),
    rotate: degrees(-90),
  });

  const locationPlacement = getCenteredTextPlacement(sans, location, PART_POSITION_LAYOUT.location);
  const rotatedLocationPlacement = rotateClockwisePoint(locationPlacement.x, locationPlacement.y);
  page.drawText(location, {
    x: rotatedLocationPlacement.x,
    y: rotatedLocationPlacement.y,
    size: locationPlacement.fontSize,
    font: sans,
    color: rgb(0, 0, 0),
    rotate: degrees(-90),
  });

  const codeImage = await pdf.embedPng(await buildQrCodeWithCenteredLogoBuffer(qrValue, 512));
  const codePlacement = rotateClockwisePoint(
    inches(PART_POSITION_LAYOUT.code.x),
    toPdfY(ADDRESS_LABEL.height, PART_POSITION_LAYOUT.code.y, PART_POSITION_LAYOUT.code.height),
  );
  page.drawImage(codeImage, {
    x: codePlacement.x,
    y: codePlacement.y,
    width: codeWidth,
    height: codeHeight,
    rotate: degrees(-90),
  });

  return Buffer.from(await pdf.save());
}

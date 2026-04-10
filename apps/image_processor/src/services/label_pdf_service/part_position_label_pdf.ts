import fs from 'node:fs';
import fontkit from '@pdf-lib/fontkit';
import { degrees, PDFDocument, type PDFFont, rgb } from 'pdf-lib';
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
  paddingX: 0.2,
  paddingY: 0.04,
  columnGap: 0.08,
  xShift: -0.02,
  yShift: -0.02,
  qrSize: 0.56,
  description: {
    topInset: 0.06,
    height: 0.4,
    fontSize: 14,
    minFontSize: 6,
    lineGap: 2,
  },
  detail: {
    gap: 0.03,
  },
  part: {
    fontSize: 15,
    minFontSize: 8,
  },
  qrCaption: {
    gap: 0.03,
    height: 0.12,
    fontSize: 8,
    minFontSize: 6,
  },
};

const PART_POSITION_TEXT_HEIGHTS = {
  part: 0.24,
};

const ROTATED_ADDRESS_LABEL = {
  width: ADDRESS_LABEL.height,
  height: ADDRESS_LABEL.width,
};

function getCenteredTextPlacement(
  font: PDFFont,
  text: string,
  layout: {
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize: number;
    minFontSize: number;
    align?: 'center' | 'left';
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
    x:
      layout.align === 'left'
        ? inches(layout.x)
        : inches(layout.x) + Math.max(0, (boxWidth - textWidth) / 2),
    y:
      toPdfY(ADDRESS_LABEL.height, layout.y, layout.height) +
      (boxHeight - textHeight) / 2 +
      baselineAdjust,
  };
}

function splitTokenToFit(font: PDFFont, token: string, fontSize: number, maxWidth: number) {
  const segments: string[] = [];
  let current = '';

  for (const character of token) {
    const next = `${current}${character}`;
    if (current && font.widthOfTextAtSize(next, fontSize) > maxWidth) {
      segments.push(current);
      current = character;
      continue;
    }

    current = next;
  }

  if (current) {
    segments.push(current);
  }

  return segments;
}

function wrapText(font: PDFFont, text: string, fontSize: number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);

  if (!words.length) {
    return [''];
  }

  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (!currentLine || font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      currentLine = candidate;
      continue;
    }

    if (font.widthOfTextAtSize(word, fontSize) > maxWidth) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = '';
      }

      const segments = splitTokenToFit(font, word, fontSize, maxWidth);
      const tail = segments.pop() || '';
      lines.push(...segments);
      currentLine = tail;
      continue;
    }

    lines.push(currentLine);
    currentLine = word;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function getWrappedTextPlacement(
  font: PDFFont,
  text: string,
  layout: {
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize: number;
    minFontSize: number;
    lineGap: number;
    align?: 'center' | 'left';
    verticalAlign?: 'center' | 'top';
  },
) {
  const boxWidth = inches(layout.width);
  const boxHeight = inches(layout.height);
  const baselineAdjust = 1;

  for (let fontSize = layout.fontSize; fontSize >= layout.minFontSize; fontSize -= 0.5) {
    const lines = wrapText(font, text, fontSize, boxWidth);
    const lineHeight = font.heightAtSize(fontSize);
    const totalHeight = lines.length * lineHeight + (lines.length - 1) * layout.lineGap;

    if (totalHeight > boxHeight) {
      continue;
    }

    const boxY = toPdfY(ADDRESS_LABEL.height, layout.y, layout.height);
    const blockBottom =
      layout.verticalAlign === 'top'
        ? boxY + boxHeight - totalHeight
        : boxY + (boxHeight - totalHeight) / 2;

    return lines.map((line, index) => {
      const textWidth = font.widthOfTextAtSize(line, fontSize);
      const lineIndexFromBottom = lines.length - index - 1;

      return {
        text: line,
        fontSize,
        x:
          layout.align === 'left'
            ? inches(layout.x)
            : inches(layout.x) + Math.max(0, (boxWidth - textWidth) / 2),
        y: blockBottom + lineIndexFromBottom * (lineHeight + layout.lineGap) + baselineAdjust,
      };
    });
  }

  const fallbackFontSize = layout.minFontSize;
  const lines = wrapText(font, text, fallbackFontSize, boxWidth);
  const lineHeight = font.heightAtSize(fallbackFontSize);
  const maxLines = Math.max(
    1,
    Math.floor((boxHeight + layout.lineGap) / (lineHeight + layout.lineGap)),
  );
  const visibleLines = lines.slice(0, maxLines);

  if (lines.length > maxLines && visibleLines.length) {
    const lastLineIndex = visibleLines.length - 1;
    let truncatedLine = visibleLines[lastLineIndex];

    while (
      truncatedLine &&
      font.widthOfTextAtSize(`${truncatedLine}...`, fallbackFontSize) > boxWidth
    ) {
      truncatedLine = truncatedLine.slice(0, -1).trimEnd();
    }

    visibleLines[lastLineIndex] = truncatedLine ? `${truncatedLine}...` : '...';
  }

  const totalHeight = visibleLines.length * lineHeight + (visibleLines.length - 1) * layout.lineGap;
  const boxY = toPdfY(ADDRESS_LABEL.height, layout.y, layout.height);
  const blockBottom =
    layout.verticalAlign === 'top'
      ? boxY + boxHeight - totalHeight
      : boxY + (boxHeight - totalHeight) / 2;

  return visibleLines.map((line, index) => {
    const textWidth = font.widthOfTextAtSize(line, fallbackFontSize);
    const lineIndexFromBottom = visibleLines.length - index - 1;

    return {
      text: line,
      fontSize: fallbackFontSize,
      x:
        layout.align === 'left'
          ? inches(layout.x)
          : inches(layout.x) + Math.max(0, (boxWidth - textWidth) / 2),
      y: blockBottom + lineIndexFromBottom * (lineHeight + layout.lineGap) + baselineAdjust,
    };
  });
}

function rotateClockwisePoint(x: number, y: number) {
  return {
    x: y,
    y: ADDRESS_LABEL.width - x,
  };
}

function applyXShift(x: number) {
  return x + PART_POSITION_LAYOUT.xShift;
}

function applyYShift(y: number) {
  return y + PART_POSITION_LAYOUT.yShift;
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

  const visualHeight = ADDRESS_LABEL.height / 72 - PART_POSITION_LAYOUT.paddingY * 2;
  const visualY = applyYShift(PART_POSITION_LAYOUT.paddingY);
  const imageSize = visualHeight;
  const imageX = applyXShift(PART_POSITION_LAYOUT.paddingX);

  const contentX = imageX + imageSize + PART_POSITION_LAYOUT.columnGap;
  const contentWidth =
    ADDRESS_LABEL.width / 72 -
    PART_POSITION_LAYOUT.paddingX * 2 -
    imageSize -
    PART_POSITION_LAYOUT.columnGap;

  const codeSize = Math.min(PART_POSITION_LAYOUT.qrSize, contentWidth - 0.4, visualHeight);
  const codeX = applyXShift(ADDRESS_LABEL.width / 72 - PART_POSITION_LAYOUT.paddingX - codeSize);
  const qrBlockHeight =
    codeSize + PART_POSITION_LAYOUT.qrCaption.gap + PART_POSITION_LAYOUT.qrCaption.height;
  const qrBlockY = visualY + (visualHeight - qrBlockHeight) / 2;
  const codeY = qrBlockY;
  const captionY = codeY + codeSize + PART_POSITION_LAYOUT.qrCaption.gap;
  const textX = contentX;
  const textWidth = Math.max(0.4, codeX - contentX - PART_POSITION_LAYOUT.columnGap);
  const descriptionHeight = PART_POSITION_LAYOUT.description.height;
  const textTopY = codeY;
  const partY = textTopY + descriptionHeight + PART_POSITION_LAYOUT.detail.gap;

  const imageWidth = inches(imageSize);
  const imageHeight = inches(imageSize);
  const codeWidth = inches(codeSize);
  const codeHeight = inches(codeSize);

  const descriptionPlacements = getWrappedTextPlacement(sans, description, {
    ...PART_POSITION_LAYOUT.description,
    x: textX,
    y: textTopY,
    width: textWidth,
    height: descriptionHeight,
    align: 'center',
    verticalAlign: 'top',
  });

  for (const descriptionPlacement of descriptionPlacements) {
    const rotatedDescriptionPlacement = rotateClockwisePoint(
      descriptionPlacement.x,
      descriptionPlacement.y,
    );

    page.drawText(descriptionPlacement.text, {
      x: rotatedDescriptionPlacement.x,
      y: rotatedDescriptionPlacement.y,
      size: descriptionPlacement.fontSize,
      font: sans,
      color: rgb(0, 0, 0),
      rotate: degrees(-90),
    });
  }

  const logoBuffer = await buildPartImageOrFallbackBuffer(
    data.partImageUrl,
    imageWidth,
    imageHeight,
  );
  const logoImage = await pdf.embedPng(logoBuffer);
  const logoPlacement = rotateClockwisePoint(
    inches(imageX),
    toPdfY(ADDRESS_LABEL.height, visualY, imageSize),
  );
  page.drawImage(logoImage, {
    x: logoPlacement.x,
    y: logoPlacement.y,
    width: imageWidth,
    height: imageHeight,
    rotate: degrees(-90),
  });

  const partPlacement = getCenteredTextPlacement(sans, part, {
    ...PART_POSITION_LAYOUT.part,
    x: textX,
    y: partY,
    width: textWidth,
    height: PART_POSITION_TEXT_HEIGHTS.part,
    align: 'center',
  });
  const rotatedPartPlacement = rotateClockwisePoint(partPlacement.x, partPlacement.y);
  page.drawText(part, {
    x: rotatedPartPlacement.x,
    y: rotatedPartPlacement.y,
    size: partPlacement.fontSize,
    font: sans,
    color: rgb(0, 0, 0),
    rotate: degrees(-90),
  });

  const codeImage = await pdf.embedPng(await buildQrCodeWithCenteredLogoBuffer(qrValue, 512));
  const codePlacement = rotateClockwisePoint(
    inches(codeX),
    toPdfY(ADDRESS_LABEL.height, codeY, codeSize),
  );
  page.drawImage(codeImage, {
    x: codePlacement.x,
    y: codePlacement.y,
    width: codeWidth,
    height: codeHeight,
    rotate: degrees(-90),
  });

  const captionPlacement = getCenteredTextPlacement(sans, location, {
    ...PART_POSITION_LAYOUT.qrCaption,
    x: codeX,
    y: captionY,
    width: codeSize,
    height: PART_POSITION_LAYOUT.qrCaption.height,
  });
  const rotatedCaptionPlacement = rotateClockwisePoint(captionPlacement.x, captionPlacement.y);
  page.drawText(location, {
    x: rotatedCaptionPlacement.x,
    y: rotatedCaptionPlacement.y,
    size: captionPlacement.fontSize,
    font: sans,
    color: rgb(0, 0, 0),
    rotate: degrees(-90),
  });

  return Buffer.from(await pdf.save());
}

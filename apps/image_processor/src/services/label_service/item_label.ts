// DYMO Address label size 30252 (2-1/4" x 1-1/4")

import fs from 'node:fs';
import fontkit from '@pdf-lib/fontkit';
import { degrees, PDFDocument, type PDFFont, rgb } from 'pdf-lib';
import {
  ADDRESS_LABEL,
  buildPartImageOrFallbackBuffer,
  buildQrCodeWithCenteredLogoBuffer,
  fitTextToBox,
  inches,
  sanitize,
  segoeUiRegularPath,
  toPdfY,
} from './shared.js';

const PART_POSITION_LAYOUT = {
  paddingX: 0.2,
  paddingY: 0.04,
  columnGap: 0.08,
  xShift: 0.15,
  yShift: -0.04,
  printableArea: {
    extraRightMargin: 0.16,
  },
  border: {
    visible: false,
    inset: 0.04,
    width: 1,
  },
  qrSize: 0.64,
  image: {
    maxWidth: 0.62,
  },
  description: {
    topInset: 0.06,
    height: 0.4,
    maxHeight: 0.5,
    fontSize: 20,
    minFontSize: 8,
    lineGap: 0.5,
  },
  detail: {
    gap: 0.03,
    bottomInset: 0.08,
  },
  part: {
    fontSize: 20,
    minFontSize: 10,
  },
  entity: {
    fontSize: 16,
    minFontSize: 8,
  },
  qrCaption: {
    gap: 0.03,
    height: 0.24,
    maxWidth: 1,
    fontSize: 8,
    minFontSize: 6,
    lineGap: 1,
    positionFontSize: 10,
    positionMinFontSize: 8,
  },
};

const ROTATED_ADDRESS_LABEL = {
  width: ADDRESS_LABEL.height,
  height: ADDRESS_LABEL.width,
};

const PART_POSITION_TEXT_HEIGHTS = {
  part: 0.16,
  entity: 0.1,
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
  const lines: string[] = [];
  const paragraphs = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!paragraphs.length) {
    return [''];
  }

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
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

function getStackedCenteredTextPlacements(
  font: PDFFont,
  lines: string[],
  layout: {
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize: number;
    minFontSize: number;
    lineGap: number;
    lastLineFontSize?: number;
    lastLineMinFontSize?: number;
  },
) {
  const visibleLines = lines.map((line) => line.trim()).filter(Boolean);
  const boxWidth = inches(layout.width);
  const boxHeight = inches(layout.height);
  const baselineAdjust = 1;

  if (!visibleLines.length) {
    return [];
  }

  const getFontSizes = (baseFontSize: number) => {
    const lastLineTarget = layout.lastLineFontSize ?? baseFontSize;
    const lastLineMin = layout.lastLineMinFontSize ?? layout.minFontSize;
    const lastLineFontSize = Math.max(lastLineMin, Math.min(lastLineTarget, baseFontSize + 2));

    return visibleLines.map((_, index) =>
      index === visibleLines.length - 1 ? lastLineFontSize : baseFontSize,
    );
  };

  for (let fontSize = layout.fontSize; fontSize >= layout.minFontSize; fontSize -= 0.5) {
    const fontSizes = getFontSizes(fontSize);
    const widestLine = Math.max(
      ...visibleLines.map((line, index) =>
        font.widthOfTextAtSize(line, fontSizes[index] ?? fontSize),
      ),
    );
    const lineHeights = fontSizes.map((size) => font.heightAtSize(size));
    const totalHeight =
      lineHeights.reduce((sum, height) => sum + height, 0) +
      (visibleLines.length - 1) * layout.lineGap;

    if (widestLine > boxWidth || totalHeight > boxHeight) {
      continue;
    }

    const blockBottom =
      toPdfY(ADDRESS_LABEL.height, layout.y, layout.height) + (boxHeight - totalHeight) / 2;

    return visibleLines.map((line, index) => {
      const currentFontSize = fontSizes[index] ?? fontSize;
      const textWidth = font.widthOfTextAtSize(line, currentFontSize);
      const yOffset =
        lineHeights.slice(index + 1).reduce((sum, height) => sum + height, 0) +
        (visibleLines.length - index - 1) * layout.lineGap;

      return {
        text: line,
        fontSize: currentFontSize,
        x: inches(layout.x) + Math.max(0, (boxWidth - textWidth) / 2),
        y: blockBottom + yOffset + baselineAdjust,
      };
    });
  }

  const fallbackFontSize = layout.minFontSize;
  const fallbackFontSizes = getFontSizes(fallbackFontSize);
  const lineHeights = fallbackFontSizes.map((size) => font.heightAtSize(size));
  const totalHeight =
    lineHeights.reduce((sum, height) => sum + height, 0) +
    (visibleLines.length - 1) * layout.lineGap;
  const blockBottom =
    toPdfY(ADDRESS_LABEL.height, layout.y, layout.height) + (boxHeight - totalHeight) / 2;

  return visibleLines.map((line, index) => {
    let visibleLine = line;
    const currentFontSize = fallbackFontSizes[index] ?? fallbackFontSize;
    while (visibleLine && font.widthOfTextAtSize(visibleLine, currentFontSize) > boxWidth) {
      visibleLine = visibleLine.slice(0, -1).trimEnd();
    }

    const text = visibleLine === line ? line : `${visibleLine}...`;
    const textWidth = font.widthOfTextAtSize(text, currentFontSize);
    const yOffset =
      lineHeights.slice(index + 1).reduce((sum, height) => sum + height, 0) +
      (visibleLines.length - index - 1) * layout.lineGap;

    return {
      text,
      fontSize: currentFontSize,
      x: inches(layout.x) + Math.max(0, (boxWidth - textWidth) / 2),
      y: blockBottom + yOffset + baselineAdjust,
    };
  });
}

function rotateClockwisePoint(x: number, y: number) {
  return {
    x: y + inches(PART_POSITION_LAYOUT.yShift),
    y: ADDRESS_LABEL.width - x + inches(PART_POSITION_LAYOUT.xShift),
  };
}

export async function buildItemLabel(data: PrintItemBody) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const page = pdf.addPage([ROTATED_ADDRESS_LABEL.width, ROTATED_ADDRESS_LABEL.height]);
  const sans = await pdf.embedFont(fs.readFileSync(segoeUiRegularPath));
  const rightMargin =
    PART_POSITION_LAYOUT.paddingX + PART_POSITION_LAYOUT.printableArea.extraRightMargin;

  const borderLeft = PART_POSITION_LAYOUT.paddingX - PART_POSITION_LAYOUT.border.inset;
  const borderRight = ADDRESS_LABEL.width / 72 - rightMargin + PART_POSITION_LAYOUT.border.inset;
  const borderTop = PART_POSITION_LAYOUT.paddingY - PART_POSITION_LAYOUT.border.inset;
  const borderBottom =
    ADDRESS_LABEL.height / 72 - PART_POSITION_LAYOUT.paddingY + PART_POSITION_LAYOUT.border.inset;

  const topLeft = rotateClockwisePoint(inches(borderLeft), toPdfY(ADDRESS_LABEL.height, borderTop));
  const topRight = rotateClockwisePoint(
    inches(borderRight),
    toPdfY(ADDRESS_LABEL.height, borderTop),
  );
  const bottomRight = rotateClockwisePoint(
    inches(borderRight),
    toPdfY(ADDRESS_LABEL.height, borderBottom),
  );
  const bottomLeft = rotateClockwisePoint(
    inches(borderLeft),
    toPdfY(ADDRESS_LABEL.height, borderBottom),
  );

  if (PART_POSITION_LAYOUT.border.visible) {
    page.drawLine({
      start: topLeft,
      end: topRight,
      thickness: PART_POSITION_LAYOUT.border.width,
      color: rgb(0, 0, 0),
    });
    page.drawLine({
      start: topRight,
      end: bottomRight,
      thickness: PART_POSITION_LAYOUT.border.width,
      color: rgb(0, 0, 0),
    });
    page.drawLine({
      start: bottomRight,
      end: bottomLeft,
      thickness: PART_POSITION_LAYOUT.border.width,
      color: rgb(0, 0, 0),
    });
    page.drawLine({
      start: bottomLeft,
      end: topLeft,
      thickness: PART_POSITION_LAYOUT.border.width,
      color: rgb(0, 0, 0),
    });
  }

  const contentLeft = borderLeft + PART_POSITION_LAYOUT.border.inset;
  const contentRight = borderRight - PART_POSITION_LAYOUT.border.inset;
  const contentTop = borderTop + PART_POSITION_LAYOUT.border.inset;
  const contentBottom = borderBottom - PART_POSITION_LAYOUT.border.inset;
  const contentWidth = Math.max(0, contentRight - contentLeft);
  const contentHeight = Math.max(0, contentBottom - contentTop);

  const description = sanitize(data.description);
  const part = sanitize(data.identifier);
  const entity = sanitize(data.entity);
  const locationLines = [sanitize(data.loc), sanitize(data.pos)].filter(Boolean);
  const qrValue = sanitize(data.qrText);

  const visualHeight = contentHeight;
  const visualY = contentTop;
  const imageWidthInches = Math.min(visualHeight, PART_POSITION_LAYOUT.image.maxWidth);
  const imageHeightInches = visualHeight;
  const imageX = contentLeft;
  const codeRegionRight = contentRight;
  const textRegionWidth = Math.max(
    0,
    contentWidth - imageWidthInches - PART_POSITION_LAYOUT.columnGap,
  );

  const contentX = imageX + imageWidthInches + PART_POSITION_LAYOUT.columnGap;
  const codeSize = Math.min(PART_POSITION_LAYOUT.qrSize, textRegionWidth - 0.4, visualHeight);
  const codeX = codeRegionRight - codeSize;
  const qrBlockHeight =
    codeSize + PART_POSITION_LAYOUT.qrCaption.gap + PART_POSITION_LAYOUT.qrCaption.height;
  const qrBlockY = visualY + (visualHeight - qrBlockHeight) / 2;
  const codeY = qrBlockY;
  const captionY = codeY + codeSize + PART_POSITION_LAYOUT.qrCaption.gap;
  const textX = contentX;
  const textWidth = Math.max(0.4, codeX - contentX - PART_POSITION_LAYOUT.columnGap);
  const textTopY = visualY + PART_POSITION_LAYOUT.description.topInset;
  const partY =
    contentBottom - PART_POSITION_TEXT_HEIGHTS.part - PART_POSITION_LAYOUT.detail.bottomInset;
  const entityY = partY - PART_POSITION_TEXT_HEIGHTS.entity;
  const descriptionHeight = Math.min(
    PART_POSITION_LAYOUT.description.maxHeight,
    Math.max(
      PART_POSITION_LAYOUT.description.height,
      entityY - textTopY - PART_POSITION_LAYOUT.detail.gap,
    ),
  );
  const captionWidth = Math.min(contentWidth, PART_POSITION_LAYOUT.qrCaption.maxWidth);
  const captionX = codeX + (codeSize - captionWidth) / 2;

  const imageWidth = inches(imageWidthInches);
  const imageHeight = inches(imageHeightInches);
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

  const logoBuffer = await buildPartImageOrFallbackBuffer(data.imageUrl, imageWidth, imageHeight);
  const logoImage = await pdf.embedPng(logoBuffer);
  const logoPlacement = rotateClockwisePoint(
    inches(imageX),
    toPdfY(ADDRESS_LABEL.height, visualY, imageHeightInches),
  );
  page.drawImage(logoImage, {
    x: logoPlacement.x,
    y: logoPlacement.y,
    width: imageWidth,
    height: imageHeight,
    rotate: degrees(-90),
  });

  const entityPlacement = getCenteredTextPlacement(sans, entity, {
    ...PART_POSITION_LAYOUT.entity,
    x: textX,
    y: entityY,
    width: textWidth,
    height: PART_POSITION_TEXT_HEIGHTS.entity,
    align: 'center',
  });
  const rotatedEntityPlacement = rotateClockwisePoint(entityPlacement.x, entityPlacement.y);
  page.drawText(entity, {
    x: rotatedEntityPlacement.x,
    y: rotatedEntityPlacement.y,
    size: entityPlacement.fontSize,
    font: sans,
    color: rgb(0, 0, 0),
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

  const codeImage = await pdf.embedPng(await buildQrCodeWithCenteredLogoBuffer(qrValue, 1024));
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

  const captionPlacements = getStackedCenteredTextPlacements(sans, locationLines, {
    x: captionX,
    y: captionY,
    width: captionWidth,
    height: PART_POSITION_LAYOUT.qrCaption.height,
    fontSize: PART_POSITION_LAYOUT.qrCaption.fontSize,
    minFontSize: PART_POSITION_LAYOUT.qrCaption.minFontSize,
    lineGap: PART_POSITION_LAYOUT.qrCaption.lineGap,
    lastLineFontSize: PART_POSITION_LAYOUT.qrCaption.positionFontSize,
    lastLineMinFontSize: PART_POSITION_LAYOUT.qrCaption.positionMinFontSize,
  });
  for (const captionPlacement of captionPlacements) {
    const rotatedCaptionPlacement = rotateClockwisePoint(captionPlacement.x, captionPlacement.y);
    page.drawText(captionPlacement.text, {
      x: rotatedCaptionPlacement.x,
      y: rotatedCaptionPlacement.y,
      size: captionPlacement.fontSize,
      font: sans,
      color: rgb(0, 0, 0),
      rotate: degrees(-90),
    });
  }

  return Buffer.from(await pdf.save());
}

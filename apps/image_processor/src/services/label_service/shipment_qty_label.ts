import fs from 'node:fs';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, type PDFFont, rgb } from 'pdf-lib';
import { buildGrayscaleLogoBuffer, inches, sanitize, segoeUiRegularPath } from './shared.js';

const LABEL_WIDTH = inches(4);
const LABEL_HEIGHT = inches(6);
const PAGE_MARGIN_X = inches(0.32);
const PAGE_MARGIN_TOP = inches(0.34);
const PAGE_MARGIN_BOTTOM = inches(0.3);
const TABLE_BOTTOM = PAGE_MARGIN_BOTTOM;
const TABLE_WIDTH = LABEL_WIDTH - PAGE_MARGIN_X * 2;
const QTY_COLUMN_WIDTH = inches(0.84);
const TABLE_HEADER_HEIGHT = inches(0.34);
const ROW_GAP = 0;
const MAX_ROWS = 12;
const TABLE_HEADER_FILL = 0.9;
const HEADER_TEXT_SIZE = 11;
const QTY_TEXT_START_SIZE = 14;
const ITEM_TEXT_START_SIZE = 11.5;
const ITEM_DESCRIPTION_TEXT_START_SIZE = 8.5;
const TITLE_TEXT_START_SIZE = 22;
const TITLE_LOGO_WIDTH = inches(0.92);
const TITLE_LOGO_HEIGHT = inches(0.46);
const TITLE_LOGO_GAP = inches(0.14);
const TITLE_SUBTITLE_GAP = inches(0.08);
const TITLE_TABLE_GAP = inches(0.18);
const SINGLE_ROW_MIN_HEIGHT = inches(0.22);
const DOUBLE_ROW_MIN_HEIGHT = inches(0.3);
const ROW_VERTICAL_PADDING = 8;
const ITEM_LINE_GAP = 1;
const QTY_OPTICAL_Y_OFFSET = 1;

function normalizeRows(rows: PrintShipmentQtyLabelRow[]) {
  return rows
    .map((row) => ({
      qty: sanitize(row.qty),
      item: sanitize(row.item),
      part: sanitize(row.part),
      description: sanitize(row.description),
    }))
    .filter((row) => row.qty || row.item || row.part || row.description)
    .slice(0, MAX_ROWS);
}

function fitText(font: PDFFont, text: string, maxWidth: number, start: number) {
  let size = start;
  while (size > 7 && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 0.5;
  }
  return size;
}

function splitTokenToFit(font: PDFFont, token: string, fontSize: number, maxWidth: number) {
  const segments: string[] = [];
  let current = '';

  for (const character of token) {
    const next = `${current}${character}`;
    if (!current || font.widthOfTextAtSize(next, fontSize) <= maxWidth) {
      current = next;
      continue;
    }

    segments.push(current);
    current = character;
  }

  if (current) segments.push(current);

  return segments;
}

function wrapText(font: PDFFont, text: string, fontSize: number, maxWidth: number) {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (!tokens.length) return [''];

  const lines: string[] = [];
  let current = '';

  for (const token of tokens) {
    const segments =
      font.widthOfTextAtSize(token, fontSize) <= maxWidth
        ? [token]
        : splitTokenToFit(font, token, fontSize, maxWidth);

    for (const segment of segments) {
      const next = current ? `${current} ${segment}` : segment;
      if (!current || font.widthOfTextAtSize(next, fontSize) <= maxWidth) {
        current = next;
        continue;
      }

      lines.push(current);
      current = segment;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function getTextBlockHeight(heights: number[], gap = ITEM_LINE_GAP) {
  if (!heights.length) return 0;
  return heights.reduce((sum, height) => sum + height, 0) + gap * (heights.length - 1);
}

function layoutWrappedLines(
  font: PDFFont,
  text: string,
  maxWidth: number,
  startSize: number,
  maxLines?: number,
) {
  let fontSize = startSize;
  let lines = wrapText(font, text || '-', fontSize, maxWidth);

  while (fontSize > 7 && maxLines && lines.length > maxLines) {
    fontSize -= 0.5;
    lines = wrapText(font, text || '-', fontSize, maxWidth);
  }

  if (maxLines && lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
  }

  const height = font.heightAtSize(fontSize, { descender: false });

  return {
    lines,
    fontSizes: lines.map(() => fontSize),
    heights: lines.map(() => height),
    baselineOffsets: lines.map(() => height),
  };
}

function splitCombinedItem(text: string) {
  const normalizedText = sanitize(text);
  if (!normalizedText) {
    return {
      part: '',
      description: '',
    };
  }

  const separatorIndex = normalizedText.indexOf(' - ');
  if (separatorIndex < 0) {
    return {
      part: normalizedText,
      description: '',
    };
  }

  return {
    part: normalizedText.slice(0, separatorIndex).trim(),
    description: normalizedText.slice(separatorIndex + 3).trim(),
  };
}

function buildItemLines(row: ReturnType<typeof normalizeRows>[number]) {
  if (row.part || row.description) {
    return [row.part || row.item || '-', row.description || ''].filter(
      (line, index) => index === 0 || line,
    );
  }

  if (row.item) {
    const parsedItem = splitCombinedItem(row.item);
    if (parsedItem.description) {
      return [parsedItem.part || '-', parsedItem.description];
    }
  }

  return [];
}

type RowLayout = {
  qtyText: string;
  qtyFontSize: number;
  qtyHeight: number;
  itemLines: string[];
  itemFontSizes: number[];
  itemHeights: number[];
  itemBaselineOffsets: number[];
  textBlockHeight: number;
  rowHeight: number;
  structured: boolean;
};

export async function buildShipmentQtyLabel(data: PrintShipmentQtyLabelBody) {
  const rows = normalizeRows(data.rows);
  if (!rows.length) {
    throw new Error('At least one qty/item row is required to build a shipment qty label.');
  }

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  const page = pdf.addPage([LABEL_WIDTH, LABEL_HEIGHT]);
  const fontBytes = fs.readFileSync(segoeUiRegularPath);
  const regularFont = await pdf.embedFont(fontBytes);
  const logoBuffer = await buildGrayscaleLogoBuffer(TITLE_LOGO_WIDTH, TITLE_LOGO_HEIGHT);
  const logoImage = await pdf.embedPng(logoBuffer);

  page.drawRectangle({
    x: 0,
    y: 0,
    width: LABEL_WIDTH,
    height: LABEL_HEIGHT,
    color: rgb(1, 1, 1),
  });

  const title = sanitize(data.title) || 'Contents:';
  const subtitle = sanitize(data.subtitle);
  const titleMaxWidth = TABLE_WIDTH - TITLE_LOGO_WIDTH - TITLE_LOGO_GAP;
  const titleSize = fitText(regularFont, title, titleMaxWidth, TITLE_TEXT_START_SIZE);
  const titleTopY = LABEL_HEIGHT - PAGE_MARGIN_TOP;
  const titleHeight = regularFont.heightAtSize(titleSize, { descender: false });
  const titleTextY = titleTopY - titleHeight;
  const logoCenterY = titleTextY + titleHeight / 2;
  const logoY = logoCenterY - TITLE_LOGO_HEIGHT / 2;
  const subtitleSize = subtitle ? fitText(regularFont, subtitle, TABLE_WIDTH, 10) : 0;
  const subtitleY = subtitle
    ? titleTextY - TITLE_SUBTITLE_GAP - regularFont.heightAtSize(subtitleSize)
    : 0;
  const titleBlockBottomY = subtitle ? subtitleY : titleTextY;
  const tableTop = titleBlockBottomY - TITLE_TABLE_GAP - TABLE_HEADER_HEIGHT;

  page.drawText(title, {
    x: PAGE_MARGIN_X,
    y: titleTextY,
    font: regularFont,
    size: titleSize,
    color: rgb(0, 0, 0),
  });

  page.drawImage(logoImage, {
    x: PAGE_MARGIN_X + TABLE_WIDTH - TITLE_LOGO_WIDTH + inches(0.02),
    y: logoY,
    width: TITLE_LOGO_WIDTH,
    height: TITLE_LOGO_HEIGHT,
  });

  if (subtitle) {
    page.drawText(subtitle, {
      x: PAGE_MARGIN_X,
      y: subtitleY,
      font: regularFont,
      size: subtitleSize,
      color: rgb(0.25, 0.25, 0.25),
    });
  }

  page.drawRectangle({
    x: PAGE_MARGIN_X,
    y: tableTop,
    width: TABLE_WIDTH,
    height: TABLE_HEADER_HEIGHT,
    color: rgb(TABLE_HEADER_FILL, TABLE_HEADER_FILL, TABLE_HEADER_FILL),
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
  });

  page.drawText('QTY', {
    x:
      PAGE_MARGIN_X +
      (QTY_COLUMN_WIDTH - regularFont.widthOfTextAtSize('QTY', HEADER_TEXT_SIZE)) / 2,
    y: tableTop + inches(0.11),
    font: regularFont,
    size: HEADER_TEXT_SIZE,
    color: rgb(0, 0, 0),
  });

  page.drawText('ITEM', {
    x: PAGE_MARGIN_X + QTY_COLUMN_WIDTH + inches(0.08),
    y: tableTop + inches(0.11),
    font: regularFont,
    size: HEADER_TEXT_SIZE,
    color: rgb(0, 0, 0),
  });

  const availableHeight = tableTop - TABLE_BOTTOM - ROW_GAP * Math.max(rows.length - 1, 0);
  const itemBoxWidth = TABLE_WIDTH - QTY_COLUMN_WIDTH - inches(0.16);
  const rowLayouts: RowLayout[] = rows.map((row) => {
    const qtyText = row.qty || '-';
    const qtyFontSize = fitText(
      regularFont,
      qtyText,
      QTY_COLUMN_WIDTH - inches(0.14),
      QTY_TEXT_START_SIZE,
    );
    const qtyHeight = regularFont.heightAtSize(qtyFontSize, { descender: false });
    const structuredItemLines = buildItemLines(row);

    if (structuredItemLines.length) {
      const partText = structuredItemLines[0] || '-';
      const descriptionText = structuredItemLines[1] || '';
      const partLayout = layoutWrappedLines(
        regularFont,
        partText,
        itemBoxWidth,
        ITEM_TEXT_START_SIZE,
        2,
      );
      const descriptionLayout = descriptionText
        ? layoutWrappedLines(
            regularFont,
            descriptionText,
            itemBoxWidth,
            ITEM_DESCRIPTION_TEXT_START_SIZE,
            2,
          )
        : { lines: [], fontSizes: [], heights: [], baselineOffsets: [] };
      const itemLines = [...partLayout.lines, ...descriptionLayout.lines];
      const itemFontSizes = [...partLayout.fontSizes, ...descriptionLayout.fontSizes];
      const itemHeights = [...partLayout.heights, ...descriptionLayout.heights];
      const itemBaselineOffsets = [
        ...partLayout.baselineOffsets,
        ...descriptionLayout.baselineOffsets,
      ];
      const textBlockHeight = getTextBlockHeight(itemHeights);

      return {
        qtyText,
        qtyFontSize,
        qtyHeight,
        itemLines,
        itemFontSizes,
        itemHeights,
        itemBaselineOffsets,
        textBlockHeight,
        rowHeight: Math.max(
          DOUBLE_ROW_MIN_HEIGHT,
          Math.max(qtyHeight, textBlockHeight) + ROW_VERTICAL_PADDING,
        ),
        structured: true,
      };
    }

    const itemLayout = layoutWrappedLines(
      regularFont,
      row.item || '-',
      itemBoxWidth,
      ITEM_TEXT_START_SIZE,
      3,
    );
    const textBlockHeight = getTextBlockHeight(itemLayout.heights);

    return {
      qtyText,
      qtyFontSize,
      qtyHeight,
      itemLines: itemLayout.lines,
      itemFontSizes: itemLayout.fontSizes,
      itemHeights: itemLayout.heights,
      itemBaselineOffsets: itemLayout.baselineOffsets,
      textBlockHeight,
      rowHeight: Math.max(
        SINGLE_ROW_MIN_HEIGHT,
        Math.max(qtyHeight, textBlockHeight) + ROW_VERTICAL_PADDING,
      ),
      structured: false,
    };
  });

  const totalRowHeight = rowLayouts.reduce((sum, layout) => sum + layout.rowHeight, 0);
  const rowHeightScale = totalRowHeight > availableHeight ? availableHeight / totalRowHeight : 1;
  let currentTop = tableTop;
  let renderedTableBottom = tableTop;

  rows.forEach((_, index) => {
    const layout = rowLayouts[index];
    if (!layout) return;

    const rowHeight = layout.rowHeight * rowHeightScale;
    const fontScale = Math.min(1, rowHeightScale);
    const rowBottom = currentTop - rowHeight;
    const fillColor = index % 2 === 0 ? rgb(1, 1, 1) : rgb(0.975, 0.975, 0.975);

    page.drawRectangle({
      x: PAGE_MARGIN_X,
      y: rowBottom,
      width: TABLE_WIDTH,
      height: rowHeight,
      color: fillColor,
      borderColor: rgb(0, 0, 0),
      borderWidth: 1,
    });

    const renderedQtyFontSize = layout.qtyFontSize * fontScale;
    const renderedQtyHeight = regularFont.heightAtSize(renderedQtyFontSize, { descender: false });
    const qtyWidth = regularFont.widthOfTextAtSize(layout.qtyText, renderedQtyFontSize);
    page.drawText(layout.qtyText, {
      x: PAGE_MARGIN_X + Math.max(inches(0.08), (QTY_COLUMN_WIDTH - qtyWidth) / 2),
      y: rowBottom + (rowHeight - renderedQtyHeight) / 2 + QTY_OPTICAL_Y_OFFSET * fontScale,
      font: regularFont,
      size: renderedQtyFontSize,
      color: rgb(0, 0, 0),
    });

    const itemBoxX = PAGE_MARGIN_X + QTY_COLUMN_WIDTH + inches(0.08);
    const renderedItemHeights = layout.itemHeights.map((height) => height * fontScale);
    const renderedItemFontSizes = layout.itemFontSizes.map((size) => size * fontScale);
    const renderedItemBaselineOffsets = layout.itemBaselineOffsets.map(
      (offset) => offset * fontScale,
    );
    const renderedLineGap = ITEM_LINE_GAP * fontScale;
    const renderedTextBlockHeight = getTextBlockHeight(renderedItemHeights, renderedLineGap);
    let itemLineTop = rowBottom + (rowHeight + renderedTextBlockHeight) / 2;

    layout.itemLines.forEach((line, lineIndex) => {
      const lineHeight = renderedItemHeights[lineIndex] || 0;
      const fontSize = renderedItemFontSizes[lineIndex] || ITEM_TEXT_START_SIZE * fontScale;
      const baselineOffset = renderedItemBaselineOffsets[lineIndex] || lineHeight;
      page.drawText(line, {
        x: itemBoxX,
        y: itemLineTop - baselineOffset,
        font: regularFont,
        size: fontSize,
        color: lineIndex === 0 ? rgb(0, 0, 0) : rgb(0.18, 0.18, 0.18),
      });
      itemLineTop -= lineHeight + renderedLineGap;
    });

    renderedTableBottom = rowBottom;
    currentTop = rowBottom - ROW_GAP;
  });

  page.drawLine({
    start: { x: PAGE_MARGIN_X + QTY_COLUMN_WIDTH, y: renderedTableBottom },
    end: { x: PAGE_MARGIN_X + QTY_COLUMN_WIDTH, y: tableTop + TABLE_HEADER_HEIGHT },
    thickness: 1,
    color: rgb(0, 0, 0),
  });

  return Buffer.from(await pdf.save());
}

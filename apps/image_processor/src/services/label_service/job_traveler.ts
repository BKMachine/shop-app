import fs from 'node:fs';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, type PDFFont, type PDFPage, rgb } from 'pdf-lib';
import {
  buildTravelerPartImageOrFallbackBuffer,
  buildQrCodeWithCenteredLogoBuffer,
  fitText,
  inches,
  sanitize,
  segoeUiRegularPath,
} from './shared.js';

const PAGE_WIDTH = 8.5 * 72;
const PAGE_HEIGHT = 11 * 72;
const PAGE_MARGIN = inches(0.38);
const HEADER_HEIGHT = inches(1.5);
const HEADER_TITLE_TOP_OFFSET = 0;
const SECTION_GAP = inches(0.16);
const DETAIL_ROW_HEIGHT = 30;
const IMAGE_BOX_SIZE = inches(1.3);
const CODE_BOX_SIZE = inches(1.3);
const HEADER_BOX_GAP = inches(0.16);
const BORDER_COLOR = rgb(0.18, 0.18, 0.18);
const MUTED_COLOR = rgb(0.4, 0.4, 0.4);
const SECTION_FILL = rgb(0.985, 0.985, 0.985);
const BAND_FILL = rgb(0.955, 0.955, 0.955);

type Box = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function drawBox(page: PDFPage, box: Box, borderWidth = 0.9, fillColor = rgb(1, 1, 1)) {
  page.drawRectangle({
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    borderColor: BORDER_COLOR,
    borderWidth,
    color: fillColor,
  });
}

function drawDivider(page: PDFPage, x: number, startY: number, endY: number, thickness = 0.8) {
  page.drawLine({
    start: { x, y: startY },
    end: { x, y: endY },
    thickness,
    color: BORDER_COLOR,
  });
}

function drawSectionCard(page: PDFPage, font: PDFFont, title: string, box: Box) {
  const borderWidth = 0.9;
  drawBox(page, box, borderWidth, SECTION_FILL);

  const bandHeight = 22;
  const bandY = box.y + box.height - bandHeight;
  page.drawRectangle({
    x: box.x,
    y: bandY,
    width: box.width,
    height: bandHeight,
    color: BAND_FILL,
  });

  page.drawLine({
    start: { x: box.x, y: bandY + bandHeight },
    end: { x: box.x + box.width, y: bandY + bandHeight },
    thickness: borderWidth,
    color: BORDER_COLOR,
  });
  page.drawLine({
    start: { x: box.x, y: bandY },
    end: { x: box.x, y: bandY + bandHeight },
    thickness: borderWidth,
    color: BORDER_COLOR,
  });
  page.drawLine({
    start: { x: box.x + box.width, y: bandY },
    end: { x: box.x + box.width, y: bandY + bandHeight },
    thickness: borderWidth,
    color: BORDER_COLOR,
  });

  page.drawText(title.toUpperCase(), {
    x: box.x + 12,
    y: bandY + 6,
    size: 10,
    font,
    color: MUTED_COLOR,
  });

  return {
    x: box.x + 12,
    y: box.y + 10,
    width: box.width - 24,
    height: box.height - bandHeight - 16,
  } satisfies Box;
}

function wrapText(font: PDFFont, text: string, fontSize: number, maxWidth: number) {
  const tokens = sanitize(text).split(/\s+/).filter(Boolean);
  if (!tokens.length) return [''];

  const lines: string[] = [];
  let currentLine = '';

  for (const token of tokens) {
    const candidate = currentLine ? `${currentLine} ${token}` : token;
    if (!currentLine || font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      currentLine = candidate;
      continue;
    }

    lines.push(currentLine);
    currentLine = token;
  }

  if (currentLine) lines.push(currentLine);
  return lines;
}

function drawMultilineText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  box: Box,
  options: { fontSize: number; lineGap?: number; minFontSize?: number },
) {
  const lineGap = options.lineGap ?? 3;
  const minFontSize = options.minFontSize ?? 8;
  let fontSize = options.fontSize;
  let lines = wrapText(font, text, fontSize, box.width);

  while (fontSize > minFontSize) {
    const lineHeight = font.heightAtSize(fontSize);
    const totalHeight = lines.length * lineHeight + Math.max(0, lines.length - 1) * lineGap;
    if (totalHeight <= box.height) break;
    fontSize -= 0.5;
    lines = wrapText(font, text, fontSize, box.width);
  }

  let cursorY = box.y + box.height - font.heightAtSize(fontSize);
  for (const line of lines) {
    page.drawText(line, {
      x: box.x,
      y: cursorY,
      size: fontSize,
      font,
      color: BORDER_COLOR,
    });
    cursorY -= font.heightAtSize(fontSize) + lineGap;
    if (cursorY < box.y - 2) break;
  }
}

function drawSectionTable(
  page: PDFPage,
  font: PDFFont,
  rows: PrintJobTravelerRow[],
  box: Box,
  options: {
    columns: number;
    labelWidthRatio: number;
    rowHeight?: number;
    valueFontSize?: number;
    minValueFontSize?: number;
  },
) {
  if (!rows.length) return;

  const padding = 6;
  const innerBox: Box = {
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
  };
  const columnCount = Math.max(1, options.columns);
  const columnGap = 14;
  const columnWidth = (innerBox.width - columnGap * (columnCount - 1)) / columnCount;
  const rowsPerColumn = Math.max(1, Math.ceil(rows.length / columnCount));
  const rowHeight = options.rowHeight ?? innerBox.height / rowsPerColumn;
  const labelSize = 8.5;
  const valueBaseSize = options.valueFontSize ?? 13;
  const minValueSize = options.minValueFontSize ?? 8.5;
  const tableTopY = innerBox.y + innerBox.height;

  rows.forEach((row, index) => {
    const columnIndex = Math.floor(index / rowsPerColumn);
    const rowIndex = index % rowsPerColumn;
    const rowBox: Box = {
      x: innerBox.x + columnIndex * (columnWidth + columnGap),
      y: tableTopY - (rowIndex + 1) * rowHeight,
      width: columnWidth,
      height: rowHeight,
    };
    const label = sanitize(row.label).toUpperCase();
    const value = sanitize(row.value);
    const labelWidth = Math.max(64, rowBox.width * options.labelWidthRatio);
    const valueX = rowBox.x + labelWidth + 8;
    const valueWidth = Math.max(20, rowBox.width - (valueX - rowBox.x) - padding);
    const valueSize = fitText(font, value, valueWidth, valueBaseSize, minValueSize);
    const labelHeight = font.heightAtSize(labelSize);
    const valueHeight = font.heightAtSize(valueSize);
    const centerY = rowBox.y + rowBox.height / 2;
    const labelY = centerY - labelHeight / 2 + 1;
    const valueY = centerY - valueHeight / 2 + 1;

    if (rowIndex > 0) {
      page.drawLine({
        start: { x: rowBox.x, y: rowBox.y + rowBox.height },
        end: { x: rowBox.x + rowBox.width, y: rowBox.y + rowBox.height },
        thickness: 0.35,
        color: rgb(0.86, 0.86, 0.86),
      });
    }

    page.drawText(label, {
      x: rowBox.x + padding,
      y: labelY,
      size: labelSize,
      font,
      color: MUTED_COLOR,
    });

    page.drawText(value, {
      x: valueX,
      y: valueY,
      size: valueSize,
      font,
      color: BORDER_COLOR,
    });
  });
}

function buildNotesText(body: PrintJobTravelerBody) {
  const notes = sanitize(body.operatorNotes);
  return notes;
}

function getRowValue(rows: PrintJobTravelerRow[], label: string) {
  return rows.find((row) => row.label === label)?.value || '';
}

export async function buildJobTravelerPdf(body: PrintJobTravelerBody) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const font = await pdf.embedFont(fs.readFileSync(segoeUiRegularPath));
  const jobDetailsColumns = 2;
  const partDetailsColumns = 1;
  const jobDetailsRowsPerColumn = Math.max(
    1,
    Math.ceil(body.jobDetails.length / jobDetailsColumns),
  );
  const partDetailsRowsPerColumn = Math.max(
    1,
    Math.ceil(body.partDetails.length / partDetailsColumns),
  );
  const detailContentPadding = 16;
  const sectionBandHeight = 22;
  const jobDetailsHeight =
    detailContentPadding + sectionBandHeight + DETAIL_ROW_HEIGHT * jobDetailsRowsPerColumn;
  const partDetailsHeight =
    detailContentPadding + sectionBandHeight + DETAIL_ROW_HEIGHT * partDetailsRowsPerColumn;

  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    color: rgb(1, 1, 1),
  });

  const headerBox: Box = {
    x: PAGE_MARGIN,
    y: PAGE_HEIGHT - PAGE_MARGIN - HEADER_HEIGHT,
    width: PAGE_WIDTH - PAGE_MARGIN * 2,
    height: HEADER_HEIGHT,
  };
  const jobDetailsBox: Box = {
    x: PAGE_MARGIN,
    y: headerBox.y - SECTION_GAP - jobDetailsHeight,
    width: headerBox.width,
    height: jobDetailsHeight,
  };
  const partDetailsBox: Box = {
    x: PAGE_MARGIN,
    y: jobDetailsBox.y - SECTION_GAP - partDetailsHeight,
    width: headerBox.width,
    height: partDetailsHeight,
  };
  const notesBox: Box = {
    x: PAGE_MARGIN,
    y: PAGE_MARGIN,
    width: headerBox.width,
    height: partDetailsBox.y - SECTION_GAP - PAGE_MARGIN,
  };

  drawBox(page, headerBox, 0.95, SECTION_FILL);

  const imageBox: Box = {
    x: headerBox.x + headerBox.width - CODE_BOX_SIZE - IMAGE_BOX_SIZE - HEADER_BOX_GAP * 2 - 10,
    y: headerBox.y + (headerBox.height - IMAGE_BOX_SIZE) / 2,
    width: IMAGE_BOX_SIZE,
    height: IMAGE_BOX_SIZE,
  };
  const codeBox: Box = {
    x: imageBox.x + imageBox.width + HEADER_BOX_GAP,
    y: headerBox.y + (headerBox.height - CODE_BOX_SIZE) / 2,
    width: CODE_BOX_SIZE,
    height: CODE_BOX_SIZE,
  };

  drawDivider(
    page,
    imageBox.x - HEADER_BOX_GAP,
    headerBox.y + 12,
    headerBox.y + headerBox.height - 12,
  );
  drawDivider(
    page,
    codeBox.x - HEADER_BOX_GAP / 2,
    headerBox.y + 12,
    headerBox.y + headerBox.height - 12,
  );

  const headerText = `Job #${Math.max(1, Number(body.jobNumber) || 1)}`;
  const partValue = getRowValue(body.jobDetails, 'Part');
  const customerValue = getRowValue(body.jobDetails, 'Customer');
  const headerTextWidth = imageBox.x - headerBox.x - 28;
  const headerSize = fitText(font, headerText, headerTextWidth, 34, 19);
  page.drawText(headerText, {
    x: headerBox.x + 18,
    y: headerBox.y + headerBox.height - font.heightAtSize(headerSize) - HEADER_TITLE_TOP_OFFSET,
    size: headerSize,
    font,
    color: BORDER_COLOR,
  });

  if (partValue) {
    const partSize = fitText(font, partValue, headerTextWidth, 15, 10);
    page.drawText(partValue, {
      x: headerBox.x + 20,
      y: headerBox.y + 28,
      size: partSize,
      font,
      color: BORDER_COLOR,
    });
  }

  if (customerValue) {
    const customerSize = fitText(font, customerValue, headerTextWidth, 10.5, 8.5);
    page.drawText(customerValue, {
      x: headerBox.x + 20,
      y: headerBox.y + 12,
      size: customerSize,
      font,
      color: MUTED_COLOR,
    });
  }

  const [partImageBuffer, codeBuffer] = await Promise.all([
    buildTravelerPartImageOrFallbackBuffer(
      body.partImageUrl,
      imageBox.width - 8,
      imageBox.height - 8,
    ),
    buildQrCodeWithCenteredLogoBuffer(sanitize(body.barcodeText) || headerText, 800),
  ]);
  const partImage = await pdf.embedPng(partImageBuffer);
  const codeImage = await pdf.embedPng(codeBuffer);

  page.drawImage(partImage, {
    x: imageBox.x + 4,
    y: imageBox.y + 4,
    width: imageBox.width - 8,
    height: imageBox.height - 8,
  });
  page.drawImage(codeImage, {
    x: codeBox.x + 4,
    y: codeBox.y + 4,
    width: codeBox.width - 8,
    height: codeBox.height - 8,
  });

  const jobDetailsContent = drawSectionCard(page, font, 'Job Details', jobDetailsBox);
  const partDetailsContent = drawSectionCard(page, font, 'Part Details', partDetailsBox);
  const notesContent = drawSectionCard(page, font, 'Operator Notes', notesBox);

  drawSectionTable(page, font, body.jobDetails, jobDetailsContent, {
    columns: 2,
    labelWidthRatio: 0.26,
    rowHeight: DETAIL_ROW_HEIGHT,
    valueFontSize: 13,
    minValueFontSize: 8.5,
  });
  drawSectionTable(page, font, body.partDetails, partDetailsContent, {
    columns: 1,
    labelWidthRatio: 0.22,
    rowHeight: DETAIL_ROW_HEIGHT,
    valueFontSize: 13,
    minValueFontSize: 8.5,
  });

  const notesText = buildNotesText(body);
  if (!notesText) {
    return Buffer.from(await pdf.save());
  }

  drawMultilineText(page, font, notesText, notesContent, {
    fontSize: 14,
    lineGap: 5,
    minFontSize: 10,
  });

  return Buffer.from(await pdf.save());
}

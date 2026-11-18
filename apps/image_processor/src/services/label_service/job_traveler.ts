import {
  PDFDocument,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  rgb,
  StandardFonts,
} from 'pdf-lib';
import sharp from 'sharp';
import {
  buildQrCodeWithCenteredLogoBuffer,
  buildTravelerPartImageOrFallbackBuffer,
  fitText,
  inches,
  sanitize,
} from './shared.js';

const PAGE_WIDTH = 8.5 * 72;
const PAGE_HEIGHT = 11 * 72;
const PAGE_BLEED = 2;
const PAGE_MARGIN = inches(0.38);
const HEADER_HEIGHT = inches(1.5);
const HEADER_TITLE_TOP_OFFSET = 10;
const SECTION_GAP = inches(0.16);
const DETAIL_GRID_COLUMNS = 4;
const DETAIL_CELL_HEIGHT = 30;
const IMAGE_BOX_SIZE = inches(1.3);
const CODE_BOX_SIZE = inches(1.3);
const HEADER_BOX_GAP = inches(0.16);
const BORDER_COLOR = rgb(0.18, 0.18, 0.18);
const MUTED_COLOR = rgb(0.4, 0.4, 0.4);
const SECTION_FILL = rgb(0.985, 0.985, 0.985);
const BAND_FILL = rgb(0.955, 0.955, 0.955);
const RULE_COLOR = rgb(0.86, 0.86, 0.86);
// Section card chrome: title band plus the inset drawSectionCard leaves above (6) and below (10).
const SECTION_BAND_HEIGHT = 22;
const SECTION_CHROME_HEIGHT = SECTION_BAND_HEIGHT + 16;
const ROUTING_HEADER_HEIGHT = 16;
// Rows are sign-off cells operators write in, so they never shrink below ~1/4".
const ROUTING_ROW_HEIGHT = 22;
const ROUTING_MIN_ROW_HEIGHT = 18;
const ROUTING_FIXED_HEIGHT = SECTION_CHROME_HEIGHT + ROUTING_HEADER_HEIGHT;
const MIN_NOTES_HEIGHT = inches(1);
// Shipment plan shares the bottom row with the notes, taking this share of the width.
const SHIPMENT_PLAN_WIDTH_RATIO = 0.46;
// Tall enough to cover the "JOB TRAVELER" corner text in the page background.
const CONTINUATION_HEADER_HEIGHT = inches(1);
// Helvetica cap height as a fraction of the font size, for centering text on a row.
const CAP_HEIGHT_RATIO = 0.718;

type Box = {
  x: number;
  y: number;
  width: number;
  height: number;
};

async function buildJobTravelerBackgroundBuffer(width: number, height: number) {
  const leftRailWidth = Math.round(width * 0.035) + Math.max(3, Math.round(width * 0.005));
  const cornerStartX = Math.round(width * 0.54);
  const cornerInsetStartX = Math.round(width * 0.69);
  const cornerLowerY = Math.round(height * 0.28);
  const cornerInsetLowerY = Math.round(height * 0.2);
  const cornerDiagonalX = Math.round(width * 0.77);
  const cornerInsetDiagonalX = Math.round(width * 0.82);
  const patternSize = Math.max(18, Math.round(width * 0.022));
  const cornerLabelX = Math.round(width * 0.79);
  const cornerLabelTopY = Math.round(height * 0.082);
  const cornerLabelBottomY = Math.round(height * 0.115);
  const circleCx = Math.round(width * 0.89);
  const circleCy = Math.round(height * 0.115);
  const circleRadius = Math.round(height * 0.06);
  const guideY = Math.round(height * 0.24);
  const guideWidth = Math.round(width * 0.22);
  const guideX = width - guideWidth - Math.round(width * 0.04);

  const svg = Buffer.from(
    `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="pageFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#FFFEFB"/>
          <stop offset="100%" stop-color="#F7F4EE"/>
        </linearGradient>
        <linearGradient id="cornerFill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#F6B064"/>
          <stop offset="52%" stop-color="#EE9646"/>
          <stop offset="100%" stop-color="#DE7A32"/>
        </linearGradient>
        <pattern id="cornerStripes" patternUnits="userSpaceOnUse" width="${patternSize}" height="${patternSize}" patternTransform="rotate(34)">
          <rect width="${patternSize}" height="${patternSize}" fill="transparent"/>
          <rect x="0" y="0" width="${Math.max(6, Math.round(patternSize * 0.34))}" height="${patternSize}" fill="#FFFFFF" opacity="0.11"/>
        </pattern>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#pageFill)"/>
      <rect x="0" y="0" width="${leftRailWidth}" height="${height}" fill="#EE9646"/>
      <polygon points="${cornerStartX},0 ${width},0 ${width},${cornerLowerY} ${cornerDiagonalX},${Math.round(height * 0.2)}" fill="url(#cornerFill)"/>
      <polygon points="${cornerInsetStartX},0 ${width},0 ${width},${cornerInsetLowerY} ${cornerInsetDiagonalX},${Math.round(height * 0.145)}" fill="#58738B" opacity="0.78"/>
      <polygon points="${cornerStartX},0 ${width},0 ${width},${cornerLowerY} ${cornerDiagonalX},${Math.round(height * 0.2)}" fill="url(#cornerStripes)" opacity="0.28"/>
      <circle cx="${circleCx}" cy="${circleCy}" r="${circleRadius}" fill="#FFFFFF" opacity="0.08"/>
      <text x="${cornerLabelX}" y="${cornerLabelTopY}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="${Math.max(19, Math.round(width * 0.034))}" font-weight="700" letter-spacing="5.5" fill="#FFF4E8">JOB</text>
      <text x="${cornerLabelX}" y="${cornerLabelBottomY}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="${Math.max(17, Math.round(width * 0.029))}" font-weight="700" letter-spacing="4.5" fill="#FFFFFF">TRAVELER</text>
      <line x1="${guideX}" y1="${guideY}" x2="${guideX + guideWidth}" y2="${guideY}" stroke="#DFAE8D" stroke-width="2" opacity="0.45"/>
      <line x1="${guideX + Math.round(guideWidth * 0.18)}" y1="${guideY + 12}" x2="${guideX + guideWidth}" y2="${guideY + 12}" stroke="#DFAE8D" stroke-width="2" opacity="0.28"/>
    </svg>`,
  );

  return sharp(svg).png().toBuffer();
}

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

function getWrappedTextLayout(
  font: PDFFont,
  text: string,
  maxWidth: number,
  options: { fontSize: number; lineGap?: number; minFontSize?: number },
) {
  const lineGap = options.lineGap ?? 3;
  const minFontSize = options.minFontSize ?? 8;
  let fontSize = options.fontSize;
  let lines = wrapText(font, text, fontSize, maxWidth);

  while (fontSize > minFontSize) {
    const nextLineCount = wrapText(font, text, fontSize - 0.5, maxWidth).length;
    if (nextLineCount > lines.length) break;
    fontSize -= 0.5;
    lines = wrapText(font, text, fontSize, maxWidth);
  }

  const lineHeight = font.heightAtSize(fontSize);
  const totalHeight = lines.length * lineHeight + Math.max(0, lines.length - 1) * lineGap;

  return {
    fontSize,
    lineGap,
    lineHeight,
    lines,
    totalHeight,
  };
}

function drawMultilineText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  box: Box,
  options: { fontSize: number; lineGap?: number; minFontSize?: number },
) {
  let layout = getWrappedTextLayout(font, text, box.width, options);

  while (layout.fontSize > (options.minFontSize ?? 8) && layout.totalHeight > box.height) {
    layout = getWrappedTextLayout(font, text, box.width, {
      ...options,
      fontSize: layout.fontSize - 0.5,
    });
  }

  let cursorY = box.y + box.height - layout.lineHeight;
  for (const line of layout.lines) {
    page.drawText(line, {
      x: box.x,
      y: cursorY,
      size: layout.fontSize,
      font,
      color: BORDER_COLOR,
    });
    cursorY -= layout.lineHeight + layout.lineGap;
    if (cursorY < box.y - 2) break;
  }
}

type DetailCell = PrintJobTravelerRow & { span: number };

// Customer and part number are already printed large in the header.
const HEADER_DETAIL_LABELS = new Set(['Customer', 'Part']);
const WIDE_DETAIL_LABELS = new Set(['Description', 'Material', 'Estimated Material']);

/** Flows detail fields into rows of a 4-column grid; long-valued fields take two columns. */
function layoutDetailGrid(rows: PrintJobTravelerRow[]): DetailCell[][] {
  const gridRows: DetailCell[][] = [];
  let current: DetailCell[] = [];
  let used = 0;

  for (const row of rows) {
    if (HEADER_DETAIL_LABELS.has(row.label)) continue;
    const span = WIDE_DETAIL_LABELS.has(row.label) ? 2 : 1;
    if (used + span > DETAIL_GRID_COLUMNS) {
      gridRows.push(current);
      current = [];
      used = 0;
    }
    current.push({ ...row, span });
    used += span;
  }

  if (current.length) gridRows.push(current);
  return gridRows;
}

function getDetailGridHeight(gridRows: DetailCell[][]) {
  return gridRows.length ? SECTION_CHROME_HEIGHT + gridRows.length * DETAIL_CELL_HEIGHT : 0;
}

function drawDetailGrid(page: PDFPage, font: PDFFont, gridRows: DetailCell[][], box: Box) {
  const columnWidth = box.width / DETAIL_GRID_COLUMNS;
  const cellPadding = 10;
  const labelSize = 7.5;
  const tableTop = box.y + box.height;

  gridRows.forEach((gridRow, rowIndex) => {
    const rowTop = tableTop - rowIndex * DETAIL_CELL_HEIGHT;
    const rowBottom = rowTop - DETAIL_CELL_HEIGHT;
    let column = 0;

    if (rowIndex > 0) {
      page.drawLine({
        start: { x: box.x, y: rowTop },
        end: { x: box.x + box.width, y: rowTop },
        thickness: 0.35,
        color: RULE_COLOR,
      });
    }

    for (const cell of gridRow) {
      const cellX = box.x + column * columnWidth;
      const textX = column === 0 ? cellX : cellX + cellPadding;
      const textWidth = cell.span * columnWidth - (textX - cellX) - cellPadding;

      if (column > 0) {
        page.drawLine({
          start: { x: cellX, y: rowTop - 4 },
          end: { x: cellX, y: rowBottom + 4 },
          thickness: 0.35,
          color: RULE_COLOR,
        });
      }

      const label = sanitize(cell.label).toUpperCase();
      page.drawText(truncateText(font, label, labelSize, textWidth), {
        x: textX,
        y: rowTop - 11,
        size: labelSize,
        font,
        color: MUTED_COLOR,
      });

      const value = sanitize(cell.value);
      const valueSize = fitText(font, value, textWidth, 12, 9);
      page.drawText(truncateText(font, value, valueSize, textWidth), {
        x: textX,
        y: rowBottom + 6,
        size: valueSize,
        font,
        color: BORDER_COLOR,
      });

      column += cell.span;
    }
  });
}

function buildNotesText(body: PrintJobTravelerBody) {
  const notes = sanitize(body.operatorNotes);
  return notes;
}

function getRowValue(rows: PrintJobTravelerRow[], label: string) {
  return rows.find((row) => row.label === label)?.value || '';
}

function getShipmentPlanHeight(shipments: PrintJobTravelerShipment[]) {
  return shipments.length ? 46 + shipments.length * 25 : 0;
}

function drawShipmentPlan(
  page: PDFPage,
  font: PDFFont,
  shipments: PrintJobTravelerShipment[],
  box: Box,
) {
  const content = drawSectionCard(page, font, 'Shipment Plan', box);
  const checkboxColumnWidth = 36;
  const dateWidth = 84;
  const qtyWidth = 50;
  const poX = content.x + checkboxColumnWidth + dateWidth + qtyWidth;
  const tableTopY = content.y + content.height;
  const headerY = tableTopY - 9;
  const rowHeight = 25;

  page.drawText('DONE', { x: content.x, y: headerY, size: 8.5, font, color: MUTED_COLOR });
  page.drawText('SHIP DATE', {
    x: content.x + checkboxColumnWidth,
    y: headerY,
    size: 8.5,
    font,
    color: MUTED_COLOR,
  });
  page.drawText('QTY', {
    x: content.x + checkboxColumnWidth + dateWidth,
    y: headerY,
    size: 8.5,
    font,
    color: MUTED_COLOR,
  });
  page.drawText('PO', { x: poX, y: headerY, size: 8.5, font, color: MUTED_COLOR });

  shipments.forEach((shipment, index) => {
    const rowTopY = tableTopY - 17 - index * rowHeight;
    const checkboxSize = 11;
    page.drawRectangle({
      x: content.x + 2,
      y: rowTopY - 18,
      width: checkboxSize,
      height: checkboxSize,
      borderColor: BORDER_COLOR,
      borderWidth: 0.9,
    });
    page.drawText(shipment.shipDate, {
      x: content.x + checkboxColumnWidth,
      y: rowTopY - 16,
      size: 10,
      font,
      color: BORDER_COLOR,
    });
    page.drawText(shipment.qty, {
      x: content.x + checkboxColumnWidth + dateWidth,
      y: rowTopY - 16,
      size: 10,
      font,
      color: BORDER_COLOR,
    });
    page.drawText(shipment.po || '-', {
      x: poX,
      y: rowTopY - 16,
      size: fitText(font, shipment.po || '-', content.x + content.width - poX, 10, 8),
      font,
      color: BORDER_COLOR,
    });
    if (index < shipments.length - 1) {
      page.drawLine({
        start: { x: content.x, y: rowTopY - 23 },
        end: { x: content.x + content.width, y: rowTopY - 23 },
        thickness: 0.35,
        color: rgb(0.86, 0.86, 0.86),
      });
    }
  });
}

function getRoutingHeight(rowCount: number, rowHeight: number) {
  return rowCount ? ROUTING_FIXED_HEIGHT + rowCount * rowHeight : 0;
}

function routingRowsThatFit(height: number, rowHeight: number) {
  return Math.max(0, Math.floor((height - ROUTING_FIXED_HEIGHT) / rowHeight));
}

function truncateText(font: PDFFont, text: string, size: number, maxWidth: number) {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;

  let truncated = text;
  while (truncated && font.widthOfTextAtSize(`${truncated}...`, size) > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated ? `${truncated.trimEnd()}...` : '';
}

/** Baseline that vertically centers capital-height text in a row spanning bottom..bottom+height. */
function centeredBaseline(bottom: number, height: number, size: number) {
  return bottom + (height - size * CAP_HEIGHT_RATIO) / 2;
}

function drawRouting(
  page: PDFPage,
  font: PDFFont,
  boldFont: PDFFont,
  title: string,
  routing: PrintJobTravelerRoutingOp[],
  box: Box,
  rowHeight: number,
) {
  const content = drawSectionCard(page, font, title, box);
  const columnGap = 8;
  const columns = {
    op: 44,
    department: 118,
    qty: 52,
    initials: 62,
    date: 72,
  };
  const operationWidth =
    content.width - columns.op - columns.department - columns.qty - columns.initials - columns.date;
  const columnX = {
    op: content.x,
    operation: content.x + columns.op,
    department: content.x + columns.op + operationWidth,
    qty: content.x + columns.op + operationWidth + columns.department,
    initials: content.x + columns.op + operationWidth + columns.department + columns.qty,
    date:
      content.x + columns.op + operationWidth + columns.department + columns.qty + columns.initials,
  };
  const tableTop = content.y + content.height;
  const headerBottom = tableTop - ROUTING_HEADER_HEIGHT;
  const headerSize = 8.5;
  const headerBaseline = centeredBaseline(headerBottom, ROUTING_HEADER_HEIGHT, headerSize);
  const headers: Array<[string, number]> = [
    ['OP', columnX.op],
    ['OPERATION', columnX.operation],
    ['DEPARTMENT', columnX.department],
    ['QTY', columnX.qty + 6],
    ['INITIALS', columnX.initials + 6],
    ['DATE', columnX.date + 6],
  ];
  for (const [label, x] of headers) {
    page.drawText(label, { x, y: headerBaseline, size: headerSize, font, color: MUTED_COLOR });
  }

  page.drawLine({
    start: { x: content.x, y: headerBottom },
    end: { x: content.x + content.width, y: headerBottom },
    thickness: 0.6,
    color: BORDER_COLOR,
  });

  const textSize = Math.min(11, Math.max(8.5, rowHeight * 0.46));
  routing.forEach((operation, index) => {
    const rowBottom = headerBottom - (index + 1) * rowHeight;
    const baseline = centeredBaseline(rowBottom, rowHeight, textSize);

    page.drawText(operation.op, {
      x: columnX.op,
      y: baseline,
      size: textSize,
      font: boldFont,
      color: BORDER_COLOR,
    });

    const operationText = sanitize(operation.operation) || '-';
    const operationMaxWidth = operationWidth - columnGap;
    const operationSize = fitText(font, operationText, operationMaxWidth, textSize, 9);
    page.drawText(truncateText(font, operationText, operationSize, operationMaxWidth), {
      x: columnX.operation,
      y: centeredBaseline(rowBottom, rowHeight, operationSize),
      size: operationSize,
      font,
      color: BORDER_COLOR,
    });

    const departmentText = sanitize(operation.department) || '-';
    const departmentMaxWidth = columns.department - columnGap;
    const departmentSize = fitText(font, departmentText, departmentMaxWidth, textSize, 9);
    page.drawText(truncateText(font, departmentText, departmentSize, departmentMaxWidth), {
      x: columnX.department,
      y: centeredBaseline(rowBottom, rowHeight, departmentSize),
      size: departmentSize,
      font,
      color: BORDER_COLOR,
    });

    if (index < routing.length - 1) {
      page.drawLine({
        start: { x: content.x, y: rowBottom },
        end: { x: content.x + content.width, y: rowBottom },
        thickness: 0.35,
        color: RULE_COLOR,
      });
    }
  });

  // Write-in sign-off columns, ruled off so operators have a cell per op.
  const rowsBottom = headerBottom - routing.length * rowHeight;
  for (const x of [columnX.qty, columnX.initials, columnX.date]) {
    page.drawLine({
      start: { x, y: headerBottom },
      end: { x, y: rowsBottom },
      thickness: 0.35,
      color: RULE_COLOR,
    });
  }
}

function drawRoutingContinuationPages(
  pdf: PDFDocument,
  font: PDFFont,
  boldFont: PDFFont,
  options: {
    backgroundImage: PDFImage;
    title: string;
    routing: PrintJobTravelerRoutingOp[];
  },
) {
  const width = PAGE_WIDTH - PAGE_MARGIN * 2;
  const headerBox: Box = {
    x: PAGE_MARGIN,
    y: PAGE_HEIGHT - PAGE_MARGIN - CONTINUATION_HEADER_HEIGHT,
    width,
    height: CONTINUATION_HEADER_HEIGHT,
  };
  const rowsPerPage = routingRowsThatFit(
    headerBox.y - SECTION_GAP - PAGE_MARGIN,
    ROUTING_ROW_HEIGHT,
  );
  let remaining = options.routing;
  let continued = false;

  while (remaining.length) {
    const pageRouting = remaining.slice(0, rowsPerPage);
    remaining = remaining.slice(rowsPerPage);
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    page.drawImage(options.backgroundImage, {
      x: -PAGE_BLEED,
      y: -PAGE_BLEED,
      width: PAGE_WIDTH + PAGE_BLEED * 2,
      height: PAGE_HEIGHT + PAGE_BLEED * 2,
    });

    drawBox(page, headerBox, 0.95, SECTION_FILL);
    const titleSize = fitText(font, options.title, headerBox.width - 36, 20, 12);
    page.drawText(options.title, {
      x: headerBox.x + 18,
      y: centeredBaseline(headerBox.y, headerBox.height, titleSize),
      size: titleSize,
      font,
      color: BORDER_COLOR,
    });

    const routingHeight = getRoutingHeight(pageRouting.length, ROUTING_ROW_HEIGHT);
    let title = continued ? 'Routing (continued)' : 'Routing';
    if (remaining.length) title += ' - more on next page';
    drawRouting(
      page,
      font,
      boldFont,
      title,
      pageRouting,
      {
        x: PAGE_MARGIN,
        y: headerBox.y - SECTION_GAP - routingHeight,
        width,
        height: routingHeight,
      },
      ROUTING_ROW_HEIGHT,
    );
    continued = true;
  }
}

export async function buildJobTravelerPdf(body: PrintJobTravelerBody) {
  const pdf = await PDFDocument.create();

  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const jobDetailGrid = layoutDetailGrid(body.jobDetails);
  const partDetailGrid = layoutDetailGrid(body.partDetails);
  const jobDetailsHeight = getDetailGridHeight(jobDetailGrid);
  const partDetailsHeight = getDetailGridHeight(partDetailGrid);
  const shipmentPlan = body.shipmentPlan ?? [];
  const shipmentPlanHeight = getShipmentPlanHeight(shipmentPlan);
  const routing = body.routing ?? [];
  // Shipment plan and notes share the bottom row, which is at least as tall as either needs.
  const bottomRowMinHeight = Math.max(MIN_NOTES_HEIGHT, shipmentPlanHeight);
  const detailsBottomY =
    PAGE_HEIGHT -
    PAGE_MARGIN -
    HEADER_HEIGHT -
    (jobDetailsHeight ? SECTION_GAP + jobDetailsHeight : 0) -
    (partDetailsHeight ? SECTION_GAP + partDetailsHeight : 0);
  const routingSpace =
    detailsBottomY - SECTION_GAP - SECTION_GAP - bottomRowMinHeight - PAGE_MARGIN;
  // A routing that fits stays on page one; a longer one moves whole to its own page rather than
  // splitting mid-route.
  const routingOnFirstPage =
    routing.length > 0 &&
    routingRowsThatFit(routingSpace, ROUTING_MIN_ROW_HEIGHT) >= routing.length;
  const firstPageRouting = routingOnFirstPage ? routing : [];
  const continuedRouting = routingOnFirstPage ? [] : routing;
  const routingRowHeight = Math.min(
    ROUTING_ROW_HEIGHT,
    (routingSpace - ROUTING_FIXED_HEIGHT) / Math.max(1, firstPageRouting.length),
  );

  const backgroundImage = await pdf.embedPng(
    await buildJobTravelerBackgroundBuffer(Math.round(PAGE_WIDTH * 2), Math.round(PAGE_HEIGHT * 2)),
  );

  page.drawImage(backgroundImage, {
    x: -PAGE_BLEED,
    y: -PAGE_BLEED,
    width: PAGE_WIDTH + PAGE_BLEED * 2,
    height: PAGE_HEIGHT + PAGE_BLEED * 2,
  });

  const headerBox: Box = {
    x: PAGE_MARGIN,
    y: PAGE_HEIGHT - PAGE_MARGIN - HEADER_HEIGHT,
    width: PAGE_WIDTH - PAGE_MARGIN * 2,
    height: HEADER_HEIGHT,
  };
  const jobDetailsBox: Box | null = jobDetailsHeight
    ? {
        x: PAGE_MARGIN,
        y: headerBox.y - SECTION_GAP - jobDetailsHeight,
        width: headerBox.width,
        height: jobDetailsHeight,
      }
    : null;
  const partDetailsBox: Box | null = partDetailsHeight
    ? {
        x: PAGE_MARGIN,
        y: (jobDetailsBox?.y ?? headerBox.y) - SECTION_GAP - partDetailsHeight,
        width: headerBox.width,
        height: partDetailsHeight,
      }
    : null;
  const routingHeight = getRoutingHeight(firstPageRouting.length, routingRowHeight);
  const routingBox: Box | null = routingHeight
    ? {
        x: PAGE_MARGIN,
        y: detailsBottomY - SECTION_GAP - routingHeight,
        width: headerBox.width,
        height: routingHeight,
      }
    : null;
  const bottomRowTop = (routingBox?.y ?? detailsBottomY) - SECTION_GAP;
  const bottomRowHeight = bottomRowTop - PAGE_MARGIN;
  const shipmentPlanWidth = shipmentPlanHeight
    ? Math.round(headerBox.width * SHIPMENT_PLAN_WIDTH_RATIO)
    : 0;
  const shipmentPlanBox: Box | null = shipmentPlanHeight
    ? { x: PAGE_MARGIN, y: PAGE_MARGIN, width: shipmentPlanWidth, height: bottomRowHeight }
    : null;
  const notesX = shipmentPlanBox ? PAGE_MARGIN + shipmentPlanWidth + SECTION_GAP : PAGE_MARGIN;
  const notesBox: Box = {
    x: notesX,
    y: PAGE_MARGIN,
    width: headerBox.x + headerBox.width - notesX,
    height: bottomRowHeight,
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

  if (jobDetailsBox) {
    const content = drawSectionCard(page, font, 'Job Details', jobDetailsBox);
    drawDetailGrid(page, font, jobDetailGrid, content);
  }
  if (partDetailsBox) {
    const content = drawSectionCard(page, font, 'Part Details', partDetailsBox);
    drawDetailGrid(page, font, partDetailGrid, content);
  }
  if (routingBox) {
    drawRouting(page, font, boldFont, 'Routing', firstPageRouting, routingBox, routingRowHeight);
  }
  if (shipmentPlanBox) drawShipmentPlan(page, font, shipmentPlan, shipmentPlanBox);
  const notesContent = drawSectionCard(page, font, 'Operator Notes', notesBox);
  const flagBox = partDetailsBox ?? jobDetailsBox;
  if (continuedRouting.length && flagBox) {
    const flag = 'ROUTING ON PAGE 2';
    const flagSize = 10;
    page.drawText(flag, {
      x: flagBox.x + flagBox.width - 12 - boldFont.widthOfTextAtSize(flag, flagSize),
      y: flagBox.y + flagBox.height - SECTION_BAND_HEIGHT + 6,
      size: flagSize,
      font: boldFont,
      color: BORDER_COLOR,
    });
  }

  const notesText = buildNotesText(body);
  if (notesText) {
    drawMultilineText(page, font, notesText, notesContent, {
      fontSize: 14,
      lineGap: 5,
      minFontSize: 10,
    });
  }

  drawRoutingContinuationPages(pdf, font, boldFont, {
    backgroundImage,
    title: `${headerText}${partValue ? `  -  ${partValue}` : ''}`,
    routing: continuedRouting,
  });

  return Buffer.from(await pdf.save());
}

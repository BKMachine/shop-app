import { PDFDocument, PDFName, PDFNumber, type PDFPage, PDFString } from 'pdf-lib';
import { getDocument, PDFWorker } from 'pdfjs-dist/legacy/build/pdf.mjs';
import logger from '../../logger.js';

type HighlightLabel = 'materialType' | 'type' | 'dimension' | 'rate' | 'date';

interface HighlightTarget {
  text: string;
  label: HighlightLabel;
  line: string;
  lineAnchor: string | null;
  remaining: number;
}

interface ItemRect {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PdfTextItemLike {
  str: string;
  transform: number[];
  width: number;
  height?: number;
}

interface LineSegment {
  item: ItemRect;
  start: number;
  end: number;
}

interface LineLayout {
  text: string;
  segments: LineSegment[];
}

const HIGHLIGHT_COLORS: Record<HighlightLabel, [number, number, number]> = {
  materialType: [1.0, 0.945, 0.463],
  type: [0.647, 0.839, 0.655],
  dimension: [0.565, 0.792, 0.976],
  rate: [1.0, 0.8, 0.502],
  date: [0.867, 0.757, 0.976],
};

const HIGHLIGHT_OPACITY = 0.45;

export async function buildHighlightedPdf(
  originalPdfBuffer: Buffer,
  parsedResults: ParserResults[],
): Promise<Buffer | null> {
  const targets = collectTargets(parsedResults);
  if (!targets.length) {
    return null;
  }

  try {
    const pdfDoc = await PDFDocument.load(originalPdfBuffer);
    const worker = new PDFWorker({ port: null });
    const loadingTask = getDocument({
      data: new Uint8Array(originalPdfBuffer),
      worker,
    });
    const sourcePdf = await loadingTask.promise;

    for (let pageIndex = 0; pageIndex < sourcePdf.numPages; pageIndex++) {
      const sourcePage = await sourcePdf.getPage(pageIndex + 1);
      const sourceText = await sourcePage.getTextContent();
      const targetPage = pdfDoc.getPage(pageIndex);

      const itemRects = sourceText.items
        .map((item) => toItemRect(item))
        .filter((item): item is ItemRect => item !== null);

      const lineLayouts = buildLineLayouts(itemRects);
      for (const lineLayout of lineLayouts) {
        applyTargetsToLine(pdfDoc, targetPage, lineLayout, targets);
      }

      if (targets.every((target) => target.remaining <= 0)) {
        break;
      }
    }

    try {
      await loadingTask.destroy();
    } catch {
      // no-op
    }

    try {
      worker.destroy();
    } catch {
      // no-op
    }

    if (targets.every((target) => target.remaining > 0)) {
      return null;
    }

    const bytes = await pdfDoc.save();
    return Buffer.from(bytes);
  } catch (error) {
    logger.warn(
      `Failed to build highlighted PDF. Falling back to original file. ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

function collectTargets(parsedResults: ParserResults[]): HighlightTarget[] {
  const targetMap = new Map<string, HighlightTarget>();

  for (const result of parsedResults) {
    const groups = [
      { line: result.lineContext.header, highlights: result.lineContext.headerHighlights },
      { line: result.lineContext.sizes, highlights: result.lineContext.sizesHighlights },
      { line: result.lineContext.override, highlights: result.lineContext.overrideHighlights },
      { line: result.lineContext.amounts, highlights: result.lineContext.amountsHighlights },
      { line: result.lineContext.date, highlights: result.lineContext.dateHighlights },
    ];

    for (const group of groups) {
      const normalizedLine = normalizeText(group.line);
      if (!normalizedLine) continue;

      for (const highlight of group.highlights) {
        if (!isHighlightLabel(highlight.label)) continue;

        const normalizedText = normalizeText(highlight.text);
        if (!normalizedText) continue;

        const key = `${normalizedLine}::${highlight.label}::${normalizedText}`;
        const existing = targetMap.get(key);
        if (existing) {
          existing.remaining += 1;
        } else {
          const lineAnchor =
            highlight.label === 'materialType'
              ? extractLineAnchor(normalizedLine)
              : highlight.label === 'date' && normalizedLine === normalizedText
                ? normalizedText
                : null;

          targetMap.set(key, {
            text: normalizedText,
            line: normalizedLine,
            label: highlight.label,
            lineAnchor,
            remaining: 1,
          });
        }
      }
    }
  }

  return [...targetMap.values()];
}

function applyTargetsToLine(
  pdfDoc: PDFDocument,
  page: PDFPage,
  lineLayout: LineLayout,
  targets: HighlightTarget[],
) {
  if (!lineLayout.text) return;
  const normalizedLine = normalizeText(lineLayout.text);

  for (const target of targets) {
    if (target.remaining <= 0) continue;
    const usesAnchorMatching =
      target.label === 'materialType' || (target.label === 'date' && target.lineAnchor !== null);
    if (!usesAnchorMatching && target.line !== normalizedLine) continue;
    if (usesAnchorMatching && target.line !== normalizedLine) {
      if (target.lineAnchor && !normalizedLine.includes(target.lineAnchor)) continue;
      if (!target.lineAnchor) continue;
    }

    let searchStart = 0;
    while (target.remaining > 0) {
      const match = findHighlightMatch(lineLayout.text, target.text, target.label, searchStart);
      if (!match) break;

      addLineSpanHighlights(pdfDoc, page, lineLayout, match.index, match.length, target.label);
      target.remaining -= 1;

      searchStart = match.index + match.length;
    }
  }
}

function findHighlightMatch(
  lineText: string,
  targetText: string,
  label: HighlightLabel,
  searchStart: number,
): { index: number; length: number } | null {
  const exactIndex = lineText.indexOf(targetText, searchStart);
  if (exactIndex !== -1) {
    return { index: exactIndex, length: targetText.length };
  }

  if (label !== 'materialType') {
    return null;
  }

  const flexiblePattern = createFlexibleTokenPattern(targetText);
  if (!flexiblePattern) return null;

  const regex = new RegExp(flexiblePattern, 'gi');
  regex.lastIndex = searchStart;
  const match = regex.exec(lineText);
  if (!match || match.index < 0) return null;

  return { index: match.index, length: match[0]?.length ?? targetText.length };
}

function createFlexibleTokenPattern(token: string): string | null {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!escaped) return null;
  return escaped.replace(/\\[-/]/g, '\\s*[-/]\\s*');
}

function extractLineAnchor(line: string): string | null {
  const gtToken = line.match(/\bGT#\S+\b/i)?.[0];
  if (gtToken) return gtToken;

  const poToken = line.match(/\bPO#\S+\b/i)?.[0];
  if (poToken) return poToken;

  return null;
}

function addLineSpanHighlights(
  pdfDoc: PDFDocument,
  page: PDFPage,
  lineLayout: LineLayout,
  matchStart: number,
  matchLength: number,
  label: HighlightLabel,
) {
  const matchEnd = matchStart + matchLength;

  for (const segment of lineLayout.segments) {
    const overlapStart = Math.max(matchStart, segment.start);
    const overlapEnd = Math.min(matchEnd, segment.end);
    if (overlapStart >= overlapEnd) continue;

    const localStart = overlapStart - segment.start;
    const localLength = overlapEnd - overlapStart;
    const rect = getSubRect(segment.item, localStart, localLength);
    if (rect.width <= 0 || rect.height <= 0) continue;

    addHighlightAnnotation(pdfDoc, page, rect, HIGHLIGHT_COLORS[label]);
  }
}

function buildLineLayouts(items: ItemRect[]): LineLayout[] {
  if (!items.length) return [];

  const sorted = [...items].sort((a, b) => {
    const yDiff = b.y - a.y;
    if (Math.abs(yDiff) > 1.5) return yDiff;
    return a.x - b.x;
  });

  const lines: ItemRect[][] = [];

  for (const item of sorted) {
    const line = lines.find((existing) => Math.abs((existing[0]?.y ?? item.y) - item.y) <= 2.5);
    if (line) {
      line.push(item);
    } else {
      lines.push([item]);
    }
  }

  return lines
    .map((lineItems) => lineItems.sort((a, b) => a.x - b.x))
    .map((lineItems) => toLineLayout(lineItems))
    .filter((line) => line.text.length > 0);
}

function toLineLayout(lineItems: ItemRect[]): LineLayout {
  let text = '';
  const segments: LineSegment[] = [];

  for (let index = 0; index < lineItems.length; index++) {
    const item = lineItems[index];
    if (!item || !item.text) continue;

    const previous = lineItems[index - 1];
    if (previous && shouldInsertSpace(previous, item) && text.length > 0) {
      text += ' ';
    }

    const start = text.length;
    text += item.text;
    const end = text.length;
    segments.push({ item, start, end });
  }

  return { text: text.trim(), segments };
}

function shouldInsertSpace(previous: ItemRect, current: ItemRect): boolean {
  const previousRight = previous.x + previous.width;
  const gap = current.x - previousRight;
  const threshold = Math.max(0.8, Math.min(previous.height, current.height) * 0.12);
  return gap > threshold;
}

function toItemRect(rawItem: unknown): ItemRect | null {
  const item = asPdfTextItem(rawItem);
  if (!item) return null;

  const rawText = item.str ?? '';
  const text = normalizeText(rawText);
  if (!text) return null;

  const transform = item.transform ?? [];
  const x = Number(transform[4]);
  const y = Number(transform[5]);
  const width = Number(item.width);
  const height = Number(item.height || Math.abs(transform[0] ?? 0) || 10);

  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (!Number.isFinite(width) || width <= 0) return null;
  if (!Number.isFinite(height) || height <= 0) return null;

  return { text, x, y, width, height };
}

function getSubRect(item: ItemRect, start: number, length: number) {
  const totalChars = item.text.length;
  if (!totalChars) {
    return { x: item.x, y: item.y, width: item.width, height: item.height };
  }

  const charWidth = item.width / totalChars;
  const rectX = item.x + charWidth * start;
  const rectWidth = Math.max(charWidth * length, 1);

  return {
    x: rectX - 0.5,
    y: item.y - 1.5,
    width: rectWidth + 1,
    height: item.height + 3,
  };
}

function addHighlightAnnotation(
  pdfDoc: PDFDocument,
  page: PDFPage,
  rect: { x: number; y: number; width: number; height: number },
  color: [number, number, number],
) {
  const x1 = rect.x;
  const y1 = rect.y;
  const x2 = rect.x + rect.width;
  const y2 = rect.y + rect.height;

  const quadPoints = pdfDoc.context.obj([
    PDFNumber.of(x1),
    PDFNumber.of(y2),
    PDFNumber.of(x2),
    PDFNumber.of(y2),
    PDFNumber.of(x1),
    PDFNumber.of(y1),
    PDFNumber.of(x2),
    PDFNumber.of(y1),
  ]);

  const annotation = pdfDoc.context.obj({
    Type: 'Annot',
    Subtype: 'Highlight',
    Rect: [x1, y1, x2, y2],
    QuadPoints: quadPoints,
    C: color,
    CA: HIGHLIGHT_OPACITY,
    F: 4,
    T: PDFString.of('BK Material Parser'),
  });

  const annotationRef = pdfDoc.context.register(annotation);
  const existingAnnots = page.node.lookup(PDFName.of('Annots'));
  const annots =
    existingAnnots && typeof (existingAnnots as { push?: unknown }).push === 'function'
      ? (existingAnnots as unknown as { push: (item: unknown) => void })
      : (pdfDoc.context.obj([]) as { push: (item: unknown) => void });

  annots.push(annotationRef);
  page.node.set(PDFName.of('Annots'), annots as never);
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function isHighlightLabel(label: string): label is HighlightLabel {
  return (
    label === 'materialType' ||
    label === 'type' ||
    label === 'dimension' ||
    label === 'rate' ||
    label === 'date'
  );
}

function asPdfTextItem(value: unknown): PdfTextItemLike | null {
  if (!value || typeof value !== 'object') return null;

  const item = value as {
    str?: unknown;
    transform?: unknown;
    width?: unknown;
    height?: unknown;
  };

  if (typeof item.str !== 'string') return null;
  if (!Array.isArray(item.transform)) return null;
  if (typeof item.width !== 'number') return null;
  if (item.height != null && typeof item.height !== 'number') return null;

  return {
    str: item.str,
    transform: item.transform.filter((x): x is number => typeof x === 'number'),
    width: item.width,
    height: item.height ?? undefined,
  };
}

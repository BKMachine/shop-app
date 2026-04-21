import { DateTime } from 'luxon';

export interface DateExtraction {
  date: Date;
  line: string;
  token: string;
}

export function parseSlashDate(value: string): Date | null {
  for (const fmt of ['M/d/yyyy', 'M/d/yy']) {
    const dt = DateTime.fromFormat(value.trim(), fmt, { locale: 'en-US' });
    if (dt.isValid) return dt.toJSDate();
  }
  return null;
}

export function parseCompactDate(value: string): Date | null {
  for (const fmt of ['dMMMyyyy', 'dMMMyy']) {
    const dt = DateTime.fromFormat(value.trim(), fmt, { locale: 'en-US' });
    if (dt.isValid) return dt.toJSDate();
  }
  return null;
}

export function extractPdfDate(lines: string[]): DateExtraction | null {
  const lineDateLabelIndex = lines.findIndex((line) => /^Date\s*:?$/i.test(line));
  if (lineDateLabelIndex >= 0) {
    const nextLine = lines[lineDateLabelIndex + 1] ?? '';
    const token = nextLine.match(/\b(\d{1,2}\/\d{1,2}\/(?:\d{2}|\d{4}))\b/)?.[1] ?? '';
    const parsed = parseSlashDate(token);
    if (parsed) return { date: parsed, line: nextLine, token };
  }

  for (const line of lines) {
    const printedMatch = line.match(/\bPrinted\s*:\s*(\d{1,2}\/\d{1,2}\/(?:\d{2}|\d{4}))\b/i);
    if (printedMatch?.[1]) {
      const parsed = parseSlashDate(printedMatch[1]);
      if (parsed) return { date: parsed, line, token: printedMatch[1] };
    }
  }

  for (const line of lines) {
    const compactMatch = line.match(
      /\b(\d{1,2}(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\d{2,4})\b/i,
    );
    if (!compactMatch?.[0]) continue;
    const parsed = parseCompactDate(compactMatch[0]);
    if (parsed) return { date: parsed, line, token: compactMatch[0] };
  }

  for (const line of lines) {
    const directMatch = line.match(/\b(\d{1,2}\/\d{1,2}\/(?:\d{2}|\d{4}))\b/);
    if (directMatch?.[1]) {
      const parsed = parseSlashDate(directMatch[1]);
      if (parsed) return { date: parsed, line, token: directMatch[1] };
    }
  }

  return null;
}

export const costRegex: Record<string, RegExp> = {
  lb: /LBS\s*@\s*(\d+\.\d+)\s*LBS/,
  ea: /PCS\s*@\s*(\d+\.\d+)\s*EA/,
  ft: /FT\s*@\s*(\d+\.\d+)\s*FT/,
};

export function parseDimension(dim: string): number {
  const value = dim.trim();
  if (!value) return 0;

  const wallMatch = value.match(/(\d*\.?\d+)\s*W\b/i);
  if (wallMatch?.[1]) {
    const wall = Number.parseFloat(wallMatch[1]);
    return Number.isFinite(wall) ? wall : 0;
  }

  const numericToken = value.match(/^\d+[-\s]\d+\/\d+|^\d+\/\d+|^\d*\.\d+|^\d+/)?.[0];
  if (!numericToken) return 0;

  const normalizedToken = numericToken.replace(/\s+/g, '-');

  if (normalizedToken.includes('/')) {
    const mixed = normalizedToken.split('-').filter(Boolean);

    if (mixed.length === 2) {
      const [wholePart, fractionPart] = mixed;
      const [numerator, denominator] = fractionPart?.split('/') ?? [];
      const whole = Number.parseFloat(wholePart ?? '');
      const num = Number.parseFloat(numerator ?? '');
      const den = Number.parseFloat(denominator ?? '');

      if (Number.isFinite(whole) && Number.isFinite(num) && Number.isFinite(den) && den !== 0) {
        return whole + num / den;
      }
    }

    if (mixed.length === 1) {
      const [numerator, denominator] = mixed[0]?.split('/') ?? [];
      const num = Number.parseFloat(numerator ?? '');
      const den = Number.parseFloat(denominator ?? '');

      if (Number.isFinite(num) && Number.isFinite(den) && den !== 0) {
        return num / den;
      }
    }

    return 0;
  }

  const numeric = Number.parseFloat(normalizedToken);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function extractDimensionHighlightToken(segment: string): string | null {
  const value = segment.trim();
  if (!value) return null;

  const wallToken = value.match(/^(\d*\.?\d+\s*W)\b/i)?.[1]?.replace(/\s+/g, '');
  if (wallToken) return wallToken;

  const numericToken = value.match(/^(\d+[-\s]\d+\/\d+|\d+\/\d+|\d*\.\d+|\d+)/)?.[1];
  if (!numericToken) return null;

  const normalizedToken = numericToken.replace(/\s+/g, '-');
  const suffix = value.slice(numericToken.length).trimStart();
  const rawSuffix = value.slice(numericToken.length);

  if (suffix.startsWith('"')) return `${normalizedToken}"`;
  if (/^mm\b/i.test(suffix)) {
    const hasSpaceBeforeUnit = /^\s+mm\b/i.test(rawSuffix);
    return `${normalizedToken}${hasSpaceBeforeUnit ? ' ' : ''}mm`;
  }
  return normalizedToken;
}

export function extractActualDimensionSegments(line: string): string[] {
  if (!line) return [];

  const cleaned = line.replace(/^.*\bACTUAL\s+D(?:IMENSIONS|IMENTIONS)\b\s*:?/i, '').trim();

  if (!cleaned) return [];

  return cleaned
    .split(/\bX\b/i)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

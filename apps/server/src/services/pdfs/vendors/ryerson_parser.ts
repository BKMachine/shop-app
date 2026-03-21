import { calculateMaterialWeight, materials } from '@repo/utilities/materials';
import {
  costRegex,
  type DateExtraction,
  extractDimensionHighlightToken,
  extractPdfDate,
  parseDimension,
  parseSlashDate,
} from '../parser_utils.js';

export function extractRyersonEnteredDate(lines: string[]): DateExtraction | null {
  for (const line of lines) {
    const enteredMatch = line.match(/\bEntered\s*:\s*(\d{1,2}\/\d{1,2}\/(?:\d{2}|\d{4}))\b/i);
    if (!enteredMatch?.[1]) continue;
    const parsed = parseSlashDate(enteredMatch[1]);
    if (parsed) return { date: parsed, line, token: enteredMatch[1] };
  }
  return null;
}

const ryersonNumberPattern = '(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?';
const ryersonItemRegex = new RegExp(
  `^(\\d+)\\s+(${ryersonNumberPattern})\\s+(\\w+)\\s+(.+?)\\s+(${ryersonNumberPattern})\\s+(${ryersonNumberPattern})\\s+\\$(\\d+(?:\\.\\d+)?)\\s+(LB|FT|EA|PC)$`,
  'i',
);

const tubeWallGaugeToInches: Record<number, number> = {
  7: 0.18,
  8: 0.165,
  9: 0.148,
  10: 0.134,
  11: 0.12,
  12: 0.109,
  13: 0.095,
  14: 0.083,
  15: 0.072,
  16: 0.065,
  17: 0.058,
  18: 0.049,
  19: 0.042,
  20: 0.035,
  21: 0.032,
  22: 0.028,
  23: 0.025,
  24: 0.022,
  25: 0.02,
  26: 0.018,
};

export async function RyersonParser(text: string[]): Promise<ParserResults[]> {
  const extracted = extractRyersonEnteredDate(text) ?? extractPdfDate(text);
  const createdAt = extracted?.date ?? new Date();
  const dateLine = extracted?.line ?? '';
  const dateToken = extracted?.token ?? '';
  const results: ParserResults[] = [];

  for (let i = 0; i < text.length; i += 1) {
    const header = text[i] ?? '';
    const match = header.match(ryersonItemRegex);
    if (!match) continue;

    const sizes = text[i + 1] ?? '';
    if (!sizes || !/\d*\.?\d+\s*in\b/i.test(sizes)) continue;

    const unitType = normalizeRyersonUnitType(match[8] ?? '');
    const rate = Number.parseFloat(match[7] ?? '');
    if (!Number.isFinite(rate) || !costRegex[unitType]) continue;

    const materialType = extractRyersonMaterialType(match[4] ?? '');
    if (!materialType) continue;
    const description = match[4] ?? '';

    const { type, diameter, wallThickness, height, width, length } = parseRyersonMaterialDimensions(
      sizes,
      description,
    );
    if (!length || (type === 'Round' && !diameter) || (type === 'Flat' && (!height || !width))) {
      continue;
    }

    const material: {
      materialType: string;
      type: 'Flat' | 'Round';
      height: number | null;
      width: number | null;
      diameter: number | null;
      wallThickness: number | null;
      length: number | null;
    } = {
      materialType,
      type,
      height,
      width,
      diameter,
      wallThickness,
      length,
    };

    const feet = length / 12;
    if (!Number.isFinite(feet) || feet <= 0) continue;

    let weight = 0;
    let costPerFoot = 0;

    if (unitType === 'lb') {
      const calculatedWeight = calculateMaterialWeight(material);
      if (!calculatedWeight) continue;
      weight = calculatedWeight;
      costPerFoot = (weight * rate) / feet;
    } else if (unitType === 'ea') {
      costPerFoot = rate / feet;
    } else if (unitType === 'ft') {
      costPerFoot = rate;
    }

    Object.keys(material).forEach((key) => {
      if (material[key as keyof typeof material] === null) {
        delete material[key as keyof typeof material];
      }
    });

    const lineContext: ParsedLineContext = {
      separator: '',
      header,
      sizes,
      override: '',
      amounts: header,
      date: '',
      dateHighlights: [],
      headerHighlights: [
        { text: materialType, label: 'materialType' },
        ...extractRyersonTypeHighlights(description, type),
      ],
      sizesHighlights: sizes
        .split(/\bX\b/i)
        .map((segment) => segment.trim())
        .filter((segment) => segment && !/\bGA\b/i.test(segment))
        .map((segment) => extractDimensionHighlightToken(segment))
        .filter((token): token is string => Boolean(token))
        .map((token) => ({ text: token, label: 'dimension' })),
      overrideHighlights: [],
      amountsHighlights: [],
    };

    const pricingHighlight = extractRyersonPricingHighlight(header);
    if (pricingHighlight) {
      lineContext.amountsHighlights = [{ text: pricingHighlight, label: 'rate' }];
    }

    const gaugeOverride = extractRyersonGaugeOverride(sizes);
    if (gaugeOverride) {
      lineContext.override = gaugeOverride.line;
      lineContext.overrideHighlights = gaugeOverride.highlights;
    }

    results.push({
      material,
      costPerFoot,
      unitType,
      rate,
      weight,
      feet,
      lineContext: {
        ...lineContext,
        date: dateLine,
        dateHighlights: dateToken ? [{ text: dateToken, label: 'date' }] : [],
      },
      createdAt,
    });
    i += 1;
  }

  return results;
}

function parseRyersonMaterialDimensions(
  sizeLine: string,
  description: string,
): {
  type: 'Flat' | 'Round';
  diameter: number | null;
  wallThickness: number | null;
  height: number | null;
  width: number | null;
  length: number | null;
} {
  const segments = sizeLine
    .split(/\bX\b/i)
    .map((segment) => segment.trim())
    .filter(Boolean);

  const numericSegments = segments.map((segment) => parseDimension(segment));
  const descriptionUpper = description.toUpperCase();
  const isTubeLike = /\bTUBE\b|\bPIPE\b|\bDOM\b/.test(descriptionUpper);
  const isRoundLike = /\bRD\b|\bROUND\b/.test(descriptionUpper) || isTubeLike;

  let diameter: number | null = null;
  let wallThickness: number | null = null;
  let height: number | null = null;
  let width: number | null = null;
  let length: number | null = null;

  if (isTubeLike) {
    diameter = numericSegments[0] && numericSegments[0] > 0 ? numericSegments[0] : null;
    const wallSegment = segments.find((segment) => /\bW\b/i.test(segment));
    const wallFromGauge = wallSegment ? parseGaugeWallThickness(wallSegment) : null;
    const parsedWall = wallFromGauge ?? parseDimension(wallSegment ?? '');
    wallThickness = parsedWall > 0 ? parsedWall : null;
    const lastDimension = numericSegments[numericSegments.length - 1] ?? null;
    length = lastDimension && lastDimension > 0 ? lastDimension : null;
    return { type: 'Round', diameter, wallThickness, height, width, length };
  }

  if (isRoundLike) {
    diameter = numericSegments[0] && numericSegments[0] > 0 ? numericSegments[0] : null;
    length = numericSegments[1] && numericSegments[1] > 0 ? numericSegments[1] : null;
    return { type: 'Round', diameter, wallThickness, height, width, length };
  }

  height = numericSegments[0] && numericSegments[0] > 0 ? numericSegments[0] : null;
  width = numericSegments[1] && numericSegments[1] > 0 ? numericSegments[1] : null;
  length = numericSegments[2] && numericSegments[2] > 0 ? numericSegments[2] : null;
  return { type: 'Flat', diameter, wallThickness, height, width, length };
}

function extractRyersonMaterialType(description: string): string | null {
  const exactMatch = Object.keys(materials).find((m) => description.includes(m));
  if (exactMatch) return exactMatch;

  const slashGrade = description.match(/\b(\d{3})\s*\/\s*\d{3}[A-Z]?\b/i)?.[1];
  if (slashGrade && materials[slashGrade]) return slashGrade;

  return null;
}

function parseGaugeWallThickness(segment: string): number | null {
  const gaugeToken = segment.match(/(\d{1,2})\s*GA\b/i)?.[1];
  if (!gaugeToken) return null;

  const gauge = Number.parseInt(gaugeToken, 10);
  if (!Number.isFinite(gauge)) return null;

  return tubeWallGaugeToInches[gauge] ?? null;
}

function extractRyersonGaugeOverride(
  sizeLine: string,
): { line: string; highlights: LineHighlight[] } | null {
  const wallSegment = sizeLine
    .split(/\bX\b/i)
    .map((segment) => segment.trim())
    .find((segment) => /\bW\b/i.test(segment));

  if (!wallSegment) return null;

  const gaugeToken = wallSegment.match(/(\d{1,2})\s*GA\b/i)?.[1];
  if (!gaugeToken) return null;

  const convertedWall = parseGaugeWallThickness(wallSegment);
  if (!convertedWall) return null;

  const source = `${gaugeToken}GA`;
  const target = convertedWall.toString();

  return {
    line: `GAUGE CONVERSION: ${source} W -> ${target} WALL`,
    highlights: [
      { text: source, label: 'dimension' },
      { text: target, label: 'dimension' },
    ],
  };
}

function extractRyersonTypeHighlights(
  description: string,
  type: 'Flat' | 'Round',
): LineHighlight[] {
  const tokens =
    type === 'Round'
      ? description.match(/\b(RD|ROUND|TUBE|PIPE)\b/gi)
      : description.match(/\b(FLAT|SQUARE|FLT)\b/gi);

  if (!tokens) return [];

  const seen = new Set<string>();
  const highlights: LineHighlight[] = [];

  for (const token of tokens) {
    const key = token.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    highlights.push({ text: token, label: 'type' });
  }

  return highlights;
}

function extractRyersonPricingHighlight(header: string): string | null {
  const pricingText = header.match(/\$\d+(?:\.\d+)?\s+(?:LB|FT|EA|PC)\b/i)?.[0] ?? null;
  return pricingText;
}

function normalizeRyersonUnitType(unit: string): 'lb' | 'ft' | 'ea' | '' {
  const normalized = unit.trim().toUpperCase();
  if (normalized === 'LB') return 'lb';
  if (normalized === 'FT') return 'ft';
  if (normalized === 'EA' || normalized === 'PC') return 'ea';
  return '';
}

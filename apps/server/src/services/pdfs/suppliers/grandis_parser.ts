import { extractDimensionHighlightToken, extractPdfDate } from '../parser_utils.js';

const GRANDIS_ASSUMED_LENGTH_INCHES = 144;
const GRANDIS_SUPPLIER_ID = '69c2d236b0d4b0faf02ef132';
const MILLIMETERS_PER_INCH = 25.4;
const grandisTitaniumGradeRegex =
  /\b(?:Ti|Titanium)\b\s*(6\s*(?:AL|Al|al)?\s*[-/]?\s*(?:4V?|7(?:Nb)?))\b/i;
const grandisMaterialTypeMap: Record<string, string> = {
  '6-4': '6Al-4V',
  '6-4v': '6Al-4V',
  '6al-4v': '6Al-4V',
  '6-7': '6Al-7Nb',
  '6-7nb': '6Al-7Nb',
  '6al-7nb': '6Al-7Nb',
};

export async function GrandisParser(text: string[]): Promise<ParserResults[]> {
  const extracted = extractPdfDate(text);
  const createdAt = extracted?.date ?? new Date();
  const dateLine = extracted?.line ?? '';
  const dateToken = extracted?.token ?? '';
  const results: ParserResults[] = [];

  for (let i = 0; i < text.length; i += 1) {
    const header = text[i] ?? '';
    if (!isGrandisMaterialHeader(header)) continue;

    const sizes = text[i + 1] ?? '';
    const amounts = text[i + 2] ?? '';

    const diameterMatch = sizes.match(/\bDia\s*([\d.]+)\s*("|mm)/i);
    const piecesMatch = sizes.match(/-\s*(\d+)\s*pcs\b/i);
    const rateMatch = amounts.match(/\$\s*([\d.]+)\s*\/\s*lb\b/i);
    const weightMatch = amounts.match(/\bNet\s*([\d,.]+)\s*lbs\b/i);

    if (!diameterMatch?.[1] || !piecesMatch?.[1] || !rateMatch?.[1] || !weightMatch?.[1]) continue;

    const rawDiameter = Number.parseFloat(diameterMatch[1]);
    const diameterUnit = diameterMatch[2]?.toLowerCase();
    const diameter = diameterUnit === 'mm' ? rawDiameter / MILLIMETERS_PER_INCH : rawDiameter;
    const isMetric = diameterUnit === 'mm';
    const pieces = Number.parseInt(piecesMatch[1], 10);
    const rate = Number.parseFloat(rateMatch[1]);
    const totalWeight = Number.parseFloat(weightMatch[1].replace(/,/g, ''));

    if (
      !Number.isFinite(diameter) ||
      diameter <= 0 ||
      !Number.isFinite(pieces) ||
      pieces <= 0 ||
      !Number.isFinite(rate) ||
      rate <= 0 ||
      !Number.isFinite(totalWeight) ||
      totalWeight <= 0
    ) {
      continue;
    }

    const materialType = extractGrandisMaterialType(header);
    if (!materialType) continue;

    const length = GRANDIS_ASSUMED_LENGTH_INCHES;
    const feet = length / 12;
    if (!Number.isFinite(feet) || feet <= 0) continue;

    const weight = totalWeight / pieces;
    const costPerFoot = (weight * rate) / feet;

    const material: {
      materialType: string;
      type: 'Round' | 'Flat';
      isMetric: boolean;
      diameter: number | null;
      wallThickness: number | null;
      length: number | null;
      height: number | null;
      width: number | null;
      supplier: string;
    } = {
      materialType,
      type: 'Round',
      isMetric,
      diameter,
      wallThickness: null,
      length,
      height: null,
      width: null,
      supplier: GRANDIS_SUPPLIER_ID,
    };

    Object.keys(material).forEach((key) => {
      if (material[key as keyof typeof material] === null) {
        delete material[key as keyof typeof material];
      }
    });

    const diameterToken = extractDimensionHighlightToken(
      diameterMatch[0].replace(/^\s*Dia\s*/i, ''),
    );
    const typeToken = sizes.match(/\bDia\b/i)?.[0] ?? 'Dia';
    const materialTypeToken = extractGrandisMaterialTypeToken(header) ?? materialType;

    const lineContext: ParsedLineContext = {
      separator: '',
      header,
      sizes,
      override: '',
      amounts,
      date: '',
      dateHighlights: [],
      headerHighlights: [{ text: materialTypeToken, label: 'materialType' }],
      sizesHighlights: [
        { text: typeToken, label: 'type' },
        ...(diameterToken ? [{ text: diameterToken, label: 'dimension' as const }] : []),
      ],
      overrideHighlights: [],
      amountsHighlights: rateMatch[0] ? [{ text: rateMatch[0], label: 'rate' }] : [],
    };

    results.push({
      material,
      costPerFoot,
      unitType: 'lb',
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
    i += 2;
  }

  return results;
}

function isGrandisMaterialHeader(line: string): boolean {
  return extractGrandisMaterialType(line) !== null;
}

function extractGrandisMaterialType(header: string): string | null {
  const grade = extractGrandisGrade(header);
  return grade ? (grandisMaterialTypeMap[grade] ?? null) : null;
}

function extractGrandisMaterialTypeToken(header: string): string | null {
  const explicitToken = header.match(/\b6\s*(?:AL|Al|al)?\s*[-/]?\s*(?:4V|7Nb)\b/i)?.[0];
  if (explicitToken) return explicitToken;

  return header.match(grandisTitaniumGradeRegex)?.[0] ?? null;
}

function extractGrandisGrade(header: string): string | null {
  const rawGrade = header.match(grandisTitaniumGradeRegex)?.[1];
  if (!rawGrade) return null;

  const normalizedGrade = rawGrade.toLowerCase().replace(/\s+/g, '').replace(/\//g, '-');
  if (normalizedGrade.startsWith('6al-4')) return '6al-4v';
  if (normalizedGrade.startsWith('6-4')) return normalizedGrade.includes('v') ? '6-4v' : '6-4';
  if (normalizedGrade.startsWith('6al-7')) return '6al-7nb';
  if (normalizedGrade.startsWith('6-7')) return normalizedGrade.includes('nb') ? '6-7nb' : '6-7';

  return normalizedGrade;
}

import { extractDimensionHighlightToken } from '../parser_utils.js';

const grandis64Regex = /(?:\bTi\b|\bTitanium\b)\s*6\s*(?:AL|Al|al)?\s*[-\/]?\s*4V\b/i;
const GRANDIS_ASSUMED_LENGTH_INCHES = 144;

export async function GrandisParser(text: string[]): Promise<ParserResults[]> {
  const results: ParserResults[] = [];

  for (let i = 0; i < text.length; i += 1) {
    const header = text[i] ?? '';
    if (!isGrandisMaterialHeader(header)) continue;

    const sizes = text[i + 1] ?? '';
    const amounts = text[i + 2] ?? '';

    const diameterMatch = sizes.match(/\bDia\s*([\d.]+)"/i);
    const piecesMatch = sizes.match(/-\s*(\d+)\s*pcs\b/i);
    const rateMatch = amounts.match(/\$\s*([\d.]+)\s*\/\s*lb\b/i);
    const weightMatch = amounts.match(/\bNet\s*([\d,.]+)\s*lbs\b/i);

    if (!diameterMatch?.[1] || !piecesMatch?.[1] || !rateMatch?.[1] || !weightMatch?.[1]) continue;

    const diameter = Number.parseFloat(diameterMatch[1]);
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
      diameter: number | null;
      wallThickness: number | null;
      length: number | null;
      height: number | null;
      width: number | null;
    } = {
      materialType,
      type: 'Round',
      diameter,
      wallThickness: null,
      length,
      height: null,
      width: null,
    };

    Object.keys(material).forEach((key) => {
      if (material[key as keyof typeof material] === null) {
        delete material[key as keyof typeof material];
      }
    });

    const diameterToken = extractDimensionHighlightToken(`${diameterMatch[1]}"`);
    const typeToken = sizes.match(/\bDia\b/i)?.[0] ?? 'Dia';
    const materialTypeToken = extractGrandisMaterialTypeToken(header) ?? materialType;

    const lineContext: ParsedLineContext = {
      separator: '',
      header,
      sizes,
      override: '',
      amounts,
      headerHighlights: [{ text: materialTypeToken, label: 'materialType' }],
      sizesHighlights: [
        { text: typeToken, label: 'type' },
        ...(diameterToken ? [{ text: diameterToken, label: 'dimension' as const }] : []),
      ],
      overrideHighlights: [],
      amountsHighlights: rateMatch[0] ? [{ text: rateMatch[0], label: 'rate' }] : [],
    };

    results.push({ material, costPerFoot, unitType: 'lb', rate, weight, feet, lineContext });
    i += 2;
  }

  return results;
}

function isGrandisMaterialHeader(line: string): boolean {
  return grandis64Regex.test(line);
}

function extractGrandisMaterialType(header: string): string | null {
  if (grandis64Regex.test(header)) return '6Al-4V';
  return null;
}

function extractGrandisMaterialTypeToken(header: string): string | null {
  const token = header.match(/\b6\s*(?:AL|Al|al)?\s*[-\/]?\s*4V\b/i)?.[0];
  return token ?? null;
}

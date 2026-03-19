import calculateMaterialWeight, { materials } from '@repo/utilities/calculateMaterialWeight';
import { PDFParse } from 'pdf-parse';

// import MaterialService from '../database/lib/material/material_service.js';
// import logger from '../logger.js';

export default async function parseMaterialPdf(data: Buffer): Promise<ParserResults[]> {
  const text = await extractPdfText(data);
  if (text.includes('AFFILIATED METALS')) {
    const results = await AffiliatedMetalsParser(cleanLines(text));
    return results;
  }

  return [];
}

export async function extractPdfText(data: Buffer): Promise<string> {
  const parser = new PDFParse({ data });
  const result = await parser.getText();
  await parser.destroy();
  return result.text;
}

export function cleanLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export interface LineHighlight {
  text: string;
  label: string;
}

export interface ParsedLineContext {
  separator: string;
  header: string;
  sizes: string;
  override: string;
  amounts: string;
  headerHighlights: LineHighlight[];
  sizesHighlights: LineHighlight[];
  overrideHighlights: LineHighlight[];
  amountsHighlights: LineHighlight[];
}

export interface ParserResults {
  material: Partial<Material>;
  costPerFoot: number;
  unitType: string;
  rate: number;
  weight: number; // lbs per bar (>0 only when unitType === 'lb')
  feet: number;
  lineContext: ParsedLineContext;
}

export async function AffiliatedMetalsParser(text: string[]): Promise<ParserResults[]> {
  const separatorIndexes = text
    .map((line, index) => (/^-+$/.test(line) ? index : -1))
    .filter((index) => index !== -1);

  const results: ParserResults[] = [];

  for (let i = 0; i < separatorIndexes.length - 1; i += 1) {
    const start = separatorIndexes[i];
    const end = separatorIndexes[i + 1];
    if (start === undefined || end === undefined) continue;

    const blockLines = text.slice(start + 1, end).filter(Boolean);
    if (!blockLines.length) continue;

    const header = blockLines[0] ?? '';
    const amounts =
      blockLines.find(
        (line) =>
          /\bMATERIAL\b/i.test(line) && Object.values(costRegex).some((regex) => regex.test(line)),
      ) ?? '';

    const amountsIndex = blockLines.indexOf(amounts);
    const candidateLines =
      amountsIndex > 0 ? blockLines.slice(1, amountsIndex) : blockLines.slice(1);
    const sizes =
      candidateLines.find((line) => /\bX\b/.test(line) && /\d/.test(line)) ??
      candidateLines[0] ??
      '';
    const actualDimensionsLine =
      candidateLines.find((line) => /\bACTUAL\s+D(?:IMENSIONS|IMENTIONS)\b/i.test(line)) ?? '';

    if (!header || !sizes || !amounts) continue;

    const materialType = Object.keys(materials).find((m) => header.includes(m));
    if (!materialType) continue;
    const type = types.find((t) => header.includes(t));

    const rawDimensionSegments = sizes
      .split('X')
      .map((s) => s.trim())
      .filter(Boolean);
    const dimensions = rawDimensionSegments.map((s) => parseDimension(s.replace(/"/g, '')));
    const originalDimensions = [...dimensions];
    const actualDimensionSegments = extractActualDimensionSegments(actualDimensionsLine);
    const actualDimensions = actualDimensionSegments.map((s) =>
      parseDimension(s.replace(/"/g, '')),
    );
    let overrideApplied = false;

    if ((type === 'PIPE' || type === 'TUBE') && actualDimensions.length >= 2) {
      const actualDiameter = actualDimensions[0] ?? 0;
      const actualWall = actualDimensions[1] ?? 0;

      if (
        Number.isFinite(actualDiameter) &&
        actualDiameter > 0 &&
        actualDiameter !== (originalDimensions[0] ?? 0)
      ) {
        dimensions[0] = actualDiameter;
        overrideApplied = true;
      }
      if (
        Number.isFinite(actualWall) &&
        actualWall > 0 &&
        actualWall !== (originalDimensions[1] ?? 0)
      ) {
        dimensions[1] = actualWall;
        overrideApplied = true;
      }
    }

    if (type === 'SQUARE' && dimensions.length === 2) dimensions.splice(1, 0, dimensions[0] ?? 0);

    const costEntry = Object.entries(costRegex).find(([, regex]) => amounts.match(regex));
    const costMatch = costEntry ? amounts.match(costEntry[1]) : null;
    const rate = costMatch?.[1] ? parseFloat(costMatch[1]) : undefined;
    const unitType = costEntry?.[0];
    if (!rate || !unitType) continue;

    let weight = 0;

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
      type: 'Flat' as const,
      height: null,
      width: null,
      diameter: null,
      wallThickness: null,
      length: null,
    };

    if (type === 'FLAT BAR' || type === 'SQUARE') {
      material.type = 'Flat';
      material.height = dimensions[0] ?? null;
      material.width = dimensions[1] ?? null;
      material.length = dimensions[2] ?? null;
    } else if (type === 'PIPE' || type === 'TUBE') {
      material.type = 'Round';
      material.diameter = dimensions[0] ?? null;
      material.wallThickness = dimensions[1] ?? null;
      material.length = dimensions[2] ?? null;
    } else if (type === 'RND' || type === 'ROUND') {
      material.type = 'Round';
      material.diameter = dimensions[0] ?? null;
      material.length = dimensions[1] ?? null;
    }

    let costPerFoot = 0;
    const feet = (material.length || 0) / 12;

    if (unitType === 'lb') {
      const calculatedWeight = calculateMaterialWeight(material);
      if (!calculatedWeight) continue;
      weight = calculatedWeight;
      const cost = weight * rate;
      costPerFoot = cost / feet;
    } else if (unitType === 'ea') {
      costPerFoot = rate / feet;
    } else if (unitType === 'ft') {
      costPerFoot = rate;
    }

    // delete any null properties from material
    Object.keys(material).forEach((key) => {
      if (material[key as keyof typeof material] === null) {
        delete material[key as keyof typeof material];
      }
    });

    const lineContext: ParsedLineContext = {
      separator: text[start] ?? '',
      header,
      sizes,
      override: overrideApplied ? actualDimensionsLine : '',
      amounts,
      headerHighlights: [
        { text: materialType, label: 'materialType' },
        ...(type ? [{ text: type, label: 'type' }] : []),
      ],
      sizesHighlights: rawDimensionSegments
        .map((seg, index) => {
          if (overrideApplied && (type === 'PIPE' || type === 'TUBE') && index < 2) {
            return null;
          }
          return extractDimensionHighlightToken(seg);
        })
        .filter((token): token is string => Boolean(token))
        .map((token) => ({ text: token, label: 'dimension' })),
      overrideHighlights: (overrideApplied ? actualDimensionSegments : [])
        .map((seg) => extractDimensionHighlightToken(seg))
        .filter((token): token is string => Boolean(token))
        .map((token) => ({ text: token, label: 'dimension' })),
      amountsHighlights: costMatch?.[0] ? [{ text: costMatch[0], label: 'rate' }] : [],
    };

    results.push({ material, costPerFoot, unitType, rate, weight, feet, lineContext });
  }
  return results;
}

// async function updateMaterial(materialData: Partial<Material>, costPerFoot: number) {
//   const oldMaterial = await MaterialService.find(materialData);
//   if (!oldMaterial) return;
//   if (oldMaterial.costPerFoot !== costPerFoot) {
//     logger.info(
//       `Updating cost per foot for material ${oldMaterial.description} from ${oldMaterial.costPerFoot} to ${costPerFoot}`,
//     );
//     await MaterialService.updateCostPerFoot(oldMaterial._id.toString(), costPerFoot);
//   } else {
//     logger.info(
//       `Cost per foot for material ${oldMaterial.description} is already up to date: ${costPerFoot}`,
//     );
//   }
// }

const types = ['FLAT BAR', 'SQUARE', 'PIPE', 'RND', 'TUBE', 'ROUND'];
const costRegex: Record<string, RegExp> = {
  lb: /LBS\s*@\s*(\d+\.\d+)\s*LBS/,
  ea: /PCS\s*@\s*(\d+\.\d+)\s*EA/,
  ft: /FT\s*@\s*(\d+\.\d+)\s*FT/,
};

const parseDimension = (dim: string): number => {
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
};

const extractDimensionHighlightToken = (segment: string): string | null => {
  const value = segment.trim();
  if (!value) return null;

  const wallToken = value.match(/^(\d*\.?\d+\s*W)\b/i)?.[1]?.replace(/\s+/g, '');
  if (wallToken) return wallToken;

  const numericToken = value.match(/^(\d+[-\s]\d+\/\d+|\d+\/\d+|\d*\.\d+|\d+)/)?.[1];
  if (!numericToken) return null;

  const normalizedToken = numericToken.replace(/\s+/g, '-');
  const suffix = value.slice(numericToken.length).trimStart();

  return suffix.startsWith('"') ? `${normalizedToken}"` : normalizedToken;
};

const extractActualDimensionSegments = (line: string): string[] => {
  if (!line) return [];

  const cleaned = line.replace(/^.*\bACTUAL\s+D(?:IMENSIONS|IMENTIONS)\b\s*:?/i, '').trim();

  if (!cleaned) return [];

  return cleaned
    .split(/\bX\b/i)
    .map((segment) => segment.trim())
    .filter(Boolean);
};

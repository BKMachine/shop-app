import { calculateMaterialWeight, materials } from '@repo/utilities/materials';
import {
  costRegex,
  extractActualDimensionSegments,
  extractDimensionHighlightToken,
  parseDimension,
} from '../parser_utils.js';

const types = ['FLAT', 'SQUARE', 'PIPE', 'RND', 'TUBE', 'ROUND'];

interface ParsedAffiliatedBlock {
  separator: string;
  header: string;
  sizes: string;
  amounts: string;
  actualDimensionsLine: string;
  rawDimensionSegments: string[];
  actualDimensionSegments: string[];
  dimensions: number[];
  overrideApplied: boolean;
  materialType: string;
  typeToken: string;
  unitType: string;
  rate: number;
  costMatchText: string;
}

export async function AffiliatedMetalsParser(text: string[]): Promise<ParserResults[]> {
  const separatorIndexes = getSeparatorIndexes(text);
  const results: ParserResults[] = [];

  for (let i = 0; i < separatorIndexes.length - 1; i += 1) {
    const start = separatorIndexes[i];
    const end = separatorIndexes[i + 1];
    if (start === undefined || end === undefined) continue;

    const block = parseAffiliatedBlock(
      text[start] ?? '',
      text.slice(start + 1, end).filter(Boolean),
    );
    if (!block) continue;

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
      materialType: block.materialType,
      type: 'Flat' as const,
      height: null,
      width: null,
      diameter: null,
      wallThickness: null,
      length: null,
    };

    if (block.typeToken === 'FLAT' || block.typeToken === 'SQUARE') {
      material.type = 'Flat';
      material.height = block.dimensions[0] ?? null;
      material.width = block.dimensions[1] ?? null;
      material.length = block.dimensions[2] ?? null;
    } else if (block.typeToken === 'PIPE' || block.typeToken === 'TUBE') {
      material.type = 'Round';
      material.diameter = block.dimensions[0] ?? null;
      material.wallThickness = block.dimensions[1] ?? null;
      material.length = block.dimensions[2] ?? null;
    } else if (block.typeToken === 'RND' || block.typeToken === 'ROUND') {
      material.type = 'Round';
      material.diameter = block.dimensions[0] ?? null;
      material.length = block.dimensions[1] ?? null;
    }

    let costPerFoot = 0;
    const feet = (material.length || 0) / 12;

    if (block.unitType === 'lb') {
      const calculatedWeight = calculateMaterialWeight(material);
      if (!calculatedWeight) continue;
      weight = calculatedWeight;
      const cost = weight * block.rate;
      costPerFoot = cost / feet;
    } else if (block.unitType === 'ea') {
      costPerFoot = block.rate / feet;
    } else if (block.unitType === 'ft') {
      costPerFoot = block.rate;
    }

    Object.keys(material).forEach((key) => {
      if (material[key as keyof typeof material] === null) {
        delete material[key as keyof typeof material];
      }
    });

    const lineContext: ParsedLineContext = {
      separator: block.separator,
      header: block.header,
      sizes: block.sizes,
      override: block.overrideApplied ? block.actualDimensionsLine : '',
      amounts: block.amounts,
      headerHighlights: [
        { text: block.materialType, label: 'materialType' },
        { text: block.typeToken, label: 'type' },
      ],
      sizesHighlights: block.rawDimensionSegments
        .map((seg, index) => {
          if (
            block.overrideApplied &&
            (block.typeToken === 'PIPE' || block.typeToken === 'TUBE') &&
            index < 2
          ) {
            return null;
          }
          return extractDimensionHighlightToken(seg);
        })
        .filter((token): token is string => Boolean(token))
        .map((token) => ({ text: token, label: 'dimension' })),
      overrideHighlights: (block.overrideApplied ? block.actualDimensionSegments : [])
        .map((seg) => extractDimensionHighlightToken(seg))
        .filter((token): token is string => Boolean(token))
        .map((token) => ({ text: token, label: 'dimension' })),
      amountsHighlights: block.costMatchText ? [{ text: block.costMatchText, label: 'rate' }] : [],
    };

    results.push({
      material,
      costPerFoot,
      unitType: block.unitType,
      rate: block.rate,
      weight,
      feet,
      lineContext,
    });
  }
  return results;
}

function getSeparatorIndexes(text: string[]): number[] {
  return text
    .map((line, index) => (/^-+$/.test(line) ? index : -1))
    .filter((index) => index !== -1);
}

function parseAffiliatedBlock(
  separator: string,
  blockLines: string[],
): ParsedAffiliatedBlock | null {
  if (!blockLines.length) return null;

  const header = blockLines[0] ?? '';
  const amounts =
    blockLines.find(
      (line) =>
        /\bMATERIAL\b/i.test(line) && Object.values(costRegex).some((regex) => regex.test(line)),
    ) ?? '';

  const amountsIndex = blockLines.indexOf(amounts);
  const candidateLines = amountsIndex > 0 ? blockLines.slice(1, amountsIndex) : blockLines.slice(1);
  const sizes =
    candidateLines.find((line) => /\bX\b/.test(line) && /\d/.test(line)) ?? candidateLines[0] ?? '';
  const actualDimensionsLine =
    candidateLines.find((line) => /\bACTUAL\s+D(?:IMENSIONS|IMENTIONS)\b/i.test(line)) ?? '';

  if (!header || !sizes || !amounts) return null;

  const materialType = Object.keys(materials).find((m) => header.includes(m));
  const typeToken = types.find((t) => header.includes(t));
  if (!materialType || !typeToken) return null;

  const rawDimensionSegments = sizes
    .split('X')
    .map((segment) => segment.trim())
    .filter(Boolean);
  const dimensions = rawDimensionSegments.map((segment) =>
    parseDimension(segment.replace(/"/g, '')),
  );
  const originalDimensions = [...dimensions];
  const actualDimensionSegments = extractActualDimensionSegments(actualDimensionsLine);
  const actualDimensions = actualDimensionSegments.map((segment) =>
    parseDimension(segment.replace(/"/g, '')),
  );

  let overrideApplied = false;
  if ((typeToken === 'PIPE' || typeToken === 'TUBE') && actualDimensions.length >= 2) {
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

  if (typeToken === 'SQUARE' && dimensions.length === 2) {
    dimensions.splice(1, 0, dimensions[0] ?? 0);
  }

  const costEntry = Object.entries(costRegex).find(([, regex]) => amounts.match(regex));
  const costMatch = costEntry ? amounts.match(costEntry[1]) : null;
  const rate = costMatch?.[1] ? parseFloat(costMatch[1]) : undefined;
  const unitType = costEntry?.[0];
  if (!rate || !unitType || !costMatch?.[0]) return null;

  return {
    separator,
    header,
    sizes,
    amounts,
    actualDimensionsLine,
    rawDimensionSegments,
    actualDimensionSegments,
    dimensions,
    overrideApplied,
    materialType,
    typeToken,
    unitType,
    rate,
    costMatchText: costMatch[0],
  };
}

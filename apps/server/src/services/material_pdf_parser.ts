import calculateMaterialWeight, { materials } from '@repo/utilities/calculateMaterialWeight';
import { PDFParse } from 'pdf-parse';

// import MaterialService from '../database/lib/material/material_service.js';
// import logger from '../logger.js';

export default async function parseMaterialPdf(data: Buffer): Promise<void> {
  const text = await extractPdfText(data);
  if (text.includes('AFFILIATED METALS')) {
    const results = await AffiliatedMetalsParser(cleanLines(text));
    console.log(results);
    // await updateMaterial(materialData, costPerFoot);
  }
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

interface ParserResults {
  material: Partial<Material>;
  costPerFoot: number;
}

export async function AffiliatedMetalsParser(text: string[]): Promise<ParserResults[] | undefined> {
  const separatorIndexes = text
    .map((line, index) => (/^-+$/.test(line) ? index : -1))
    .filter((index) => index !== -1);

  const results: ParserResults[] = [];

  for (let i = 0; i < separatorIndexes.length - 1; i += 1) {
    const start = separatorIndexes[i];
    const end = separatorIndexes[i + 1];
    if (start === undefined || end === undefined) continue;

    const [header, sizes, amounts] = text.slice(start + 1, end);
    console.log({ header, sizes, amounts });
    if (!header || !sizes || !amounts) continue;

    const materialType = Object.keys(materials).find((m) => header.includes(m));
    console.log({ materialType });
    if (!materialType) continue;
    const type = types.find((t) => header.includes(t));
    console.log({ type });

    const dimensions = sizes.split('X').map((s) => parseDimension(s.replace(/"/g, '').trim()));
    if (type === 'SQUARE' && dimensions.length === 2) dimensions.splice(1, 0, dimensions[0] ?? 0);
    console.log({ dimensions });

    const costEntry = Object.entries(costRegex).find(([, regex]) => amounts.match(regex));
    const costMatch = costEntry ? amounts.match(costEntry[1]) : null;
    const rate = costMatch?.[1] ? parseFloat(costMatch[1]) : undefined;
    const unitType = costEntry?.[0];
    console.log({ rate, unitType });
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
    } else if (type === 'RND') {
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

    results.push({ material, costPerFoot });
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

const types = ['FLAT BAR', 'SQUARE', 'PIPE', 'RND', 'TUBE'];
const costRegex: Record<string, RegExp> = {
  lb: /LBS @ (\d+\.\d+) LBS/,
  ea: /PCS @ (\d+\.\d+) EA/,
  ft: /FT @ (\d+\.\d+) FT/,
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

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  calculatePartMaterialCost,
  calculatePartsPerBar,
  calculateTotalCycleMinutes,
} from '@repo/utilities/parts';
import { connect, disconnect } from '../src/database/index.js';
import '../src/database/lib/customer/customer_model.js';
import '../src/database/lib/material/material_model.js';
import '../src/database/lib/supplier/supplier_model.js';
import Part from '../src/database/lib/part/part_model.js';

type ExportPart = Pick<
  PartFields,
  | 'part'
  | 'description'
  | 'customerSuppliedMaterial'
  | 'materialCutType'
  | 'materialLength'
  | 'barLength'
  | 'remnantLength'
  | 'cycleTimes'
> & {
  customer?: Pick<Customer, 'name'> | null;
  material?:
    | (Omit<Material, 'supplier'> & { supplier?: Pick<Supplier, 'name'> | string | null })
    | null;
};

function hasCompleteCycleData(part: Pick<PartFields, 'cycleTimes'>) {
  const cycleTimes = part.cycleTimes || [];
  if (!cycleTimes.length) return false;
  return cycleTimes.every((cycle) => Number(cycle.time) > 0);
}

function getPartMaterialCost(part: ExportPart): number | null {
  if (part.customerSuppliedMaterial) return null;

  const material = part.material;
  if (!material || typeof material !== 'object' || !('costPerFoot' in material)) {
    return null;
  }

  const computedCost = calculatePartMaterialCost(part, material as Material);
  return computedCost > 0 ? computedCost : null;
}

function getMaterialSupplierName(part: ExportPart) {
  const supplier = part.material?.supplier;
  if (!supplier) return '';
  if (typeof supplier === 'string') return supplier;
  return supplier.name || '';
}

function getMaterialUsedInchesPerPart(part: ExportPart): number | null {
  const material = part.material;
  if (!material) return null;

  const fullBarLength = Number(material.length) || 0;
  const partsPerBar = calculatePartsPerBar(part, fullBarLength);
  if (!fullBarLength || !partsPerBar) return null;

  return fullBarLength / partsPerBar;
}

function escapeCsvCell(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

function formatNumber(value: number | null) {
  if (value == null) return '';
  return value.toFixed(4);
}

function createOutputPath() {
  const timestamp = new Date()
    .toISOString()
    .replace('T', '-')
    .replace(/\..+/, '')
    .replaceAll(':', '-');

  const outputDir = path.join('.', 'backups');
  mkdirSync(outputDir, { recursive: true });

  return path.join(outputDir, `part-material-cycle-${timestamp}.csv`);
}

async function main() {
  await connect();

  const parts = (await Part.find()
    .populate<{ customer?: Pick<Customer, 'name'> | null }>('customer')
    .populate({
      path: 'material',
      populate: {
        path: 'supplier',
        select: 'name',
      },
    })
    .lean()) as unknown as ExportPart[];

  const header = [
    'partNumber',
    'partDescription',
    'customerName',
    'materialDescription',
    'materialSupplierName',
    'materialUsedInchesPerPart',
    'materialCost',
    'cycleTimeMinutes',
  ];
  const lines = [header.join(',')];

  for (const part of parts) {
    const materialCost = getPartMaterialCost(part);
    const hasCompleteCycle = hasCompleteCycleData(part);
    const materialUsedInchesPerPart = getMaterialUsedInchesPerPart(part);

    if (!materialCost && !hasCompleteCycle) continue;

    const cycleTimeMinutes = hasCompleteCycle ? calculateTotalCycleMinutes(part.cycleTimes) : null;

    const row = [
      escapeCsvCell(part.part || ''),
      escapeCsvCell(part.description || ''),
      escapeCsvCell(part.customer?.name || ''),
      escapeCsvCell(part.material?.description || ''),
      escapeCsvCell(getMaterialSupplierName(part)),
      formatNumber(materialUsedInchesPerPart),
      formatNumber(materialCost),
      formatNumber(cycleTimeMinutes),
    ];

    lines.push(row.join(','));
  }

  const outputPath = createOutputPath();
  writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf-8');

  console.log(`Exported ${lines.length - 1} parts to ${outputPath}`);
  await disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await disconnect();
  process.exit(1);
});

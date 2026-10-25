import type { McpServer } from '@modelcontextprotocol/server';
import {
  decodeIsoMaterialValue,
  isoMaterialGroups,
  isoMaterialStateLabels,
} from '@repo/utilities/materials';
import * as z from 'zod';
import type { ToolPopulatedDoc } from '../../database/lib/tool/tool_model.js';
import Tools from '../../database/lib/tool/tool_service.js';
import { PageInput, pageResult } from './utils.js';

const isoCodes = isoMaterialGroups.map((group) => group.code);
const isoLegend = isoMaterialGroups.map((group) => `${group.code} ${group.label}`).join(', ');

const FindCuttingToolsInput = z.object({
  search: z
    .string()
    .optional()
    .describe(
      'Case-insensitive text matched against the description, item number, barcode and coating.',
    ),
  category: z.enum(['milling', 'turning', 'swiss', 'other']).optional(),
  toolType: z
    .string()
    .optional()
    .describe('Tool type, e.g. "End Mill", matched exactly (case-insensitive).'),
  isoMaterial: z
    .enum(isoCodes)
    .optional()
    .describe(`Only tools rated for this ISO material group: ${isoLegend}.`),
  cuttingDia: z
    .number()
    .positive()
    .optional()
    .describe(
      'Cutting diameter in inches. Matches diameters that start with these digits, so 0.5 also matches 0.5625.',
    ),
  minFluteLength: z.number().positive().optional().describe('Minimum flute length in inches.'),
  location: z.string().optional().describe('Storage location, matched exactly.'),
  position: z.string().optional().describe('Position within the location, matched exactly.'),
  lowStock: z
    .boolean()
    .optional()
    .describe('Only tools whose stock is at or below their reorder threshold.'),
  sort: z
    .enum(['description', 'vendor.name', 'item', 'stock', 'toolType', 'flutes', 'cost', 'location'])
    .default('description'),
  order: z.enum(['asc', 'desc']).default('asc'),
  ...PageInput,
});

function toToolSummary(tool: ToolPopulatedDoc) {
  const isoStates = decodeIsoMaterialValue(tool.isoMaterials);
  return {
    id: tool._id.toString(),
    description: tool.description,
    item: tool.item || null,
    barcode: tool.barcode || null,
    category: tool.category,
    toolType: tool.toolType || null,
    cuttingDia: tool.cuttingDia ?? null,
    fluteLength: tool.fluteLength ?? null,
    flutes: tool.flutes ?? null,
    coating: tool.coating || null,
    isoMaterials: Object.fromEntries(
      isoCodes
        .filter((code) => isoStates[code] > 0)
        .map((code) => [code, isoMaterialStateLabels[isoStates[code]]]),
    ),
    stock: tool.stock,
    stockLastUpdatedAt: tool.stockLastUpdatedAt ?? null,
    reorderThreshold: tool.reorderThreshold,
    reorderQty: tool.reorderQty,
    autoReorder: tool.autoReorder,
    onOrder: tool.onOrder,
    orderedOn: tool.orderedOn ?? null,
    location: tool.location || null,
    position: tool.position || null,
    cost: tool.cost,
    vendor: tool.vendor?.name ?? null,
    supplier: tool.supplier?.name ?? null,
    productLink: tool.productLink || null,
    techDataLink: tool.techDataLink || null,
  };
}

export default function registerToolingTools(server: McpServer): void {
  server.registerTool(
    'find_cutting_tools',
    {
      title: 'Find cutting tools',
      description: `Search the shop's cutting tool inventory (end mills, drills, inserts, ...): specs, stock on hand, reorder settings, where each is stored, cost and vendor. Sizes are in inches. isoMaterials lists the ISO material groups a tool is rated for (${isoLegend}) as Acceptable or Recommended.`,
      inputSchema: FindCuttingToolsInput,
      annotations: { readOnlyHint: true },
    },
    async ({ cuttingDia, minFluteLength, ...filters }) => {
      const page = await Tools.list({
        ...filters,
        cuttingDia: cuttingDia?.toString(),
        minFluteLength: minFluteLength?.toString(),
      });
      return pageResult('tools', page, toToolSummary);
    },
  );
}

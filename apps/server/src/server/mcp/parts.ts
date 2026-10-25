import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod';
import Parts from '../../database/lib/part/part_service.js';
import mongoObjectId from '../../utilities/mongoObjectId.js';
import { findCustomerId, jsonResult, PageInput, pageResult } from './utils.js';

const FindPartsInput = z.object({
  search: z
    .string()
    .optional()
    .describe('Case-insensitive text matched against the part number and description.'),
  customer: z
    .string()
    .optional()
    .describe("Customer name, or enough of it to match only one customer's name."),
  location: z.string().optional().describe('Storage location, matched exactly.'),
  position: z.string().optional().describe('Position within the location, matched exactly.'),
  includeSubcomponents: z
    .boolean()
    .default(true)
    .describe('Include parts that are only used inside assemblies.'),
  sort: z
    .enum(['part', 'description', 'customer.name', 'shopRate', 'price', 'stock', 'location'])
    .default('part'),
  order: z.enum(['asc', 'desc']).default('asc'),
  ...PageInput,
});

const GetPartInput = z.object({
  partId: mongoObjectId.describe('Part id from find_parts, or a job.'),
});

function toPartSummary(part: PartListItem) {
  return {
    id: part._id.toString(),
    part: part.part,
    revision: part.revision || null,
    description: part.description,
    customer: part.customer?.name ?? null,
    stock: part.stock,
    location: part.location || null,
    position: part.position || null,
    price: part.price,
    shopRate: part.derived?.shopRate ?? 0,
    needsReview: part.needsReview,
    isAssembly: part.hasSubComponents,
    isSubComponent: part.isSubComponent,
  };
}

function toRelatedPart({ part, qty }: PartRelationItem) {
  return { id: part._id.toString(), part: part.part, description: part.description, qty };
}

export default function registerPartTools(server: McpServer): void {
  server.registerTool(
    'find_parts',
    {
      title: 'Find parts',
      description:
        'Search the parts the shop makes for customers. Results are summaries with the part id; use get_part for cycle times, material and costs. price is the sale price per part and shopRate the earnings in $/hour after material.',
      inputSchema: FindPartsInput,
      annotations: { readOnlyHint: true },
    },
    async ({ customer, ...filters }) => {
      const page = await Parts.list({
        ...filters,
        customer: customer ? await findCustomerId(customer) : undefined,
      });
      return pageResult('parts', page, toPartSummary);
    },
  );

  server.registerTool(
    'get_part',
    {
      title: 'Get part',
      description:
        "A part's full details: customer, stock and location, sale price, material and how it is cut, cycle times per operation in minutes, additional costs, the assemblies it is used in and its sub-components. costs gives the per-part material cost, total cycle minutes and shop rate ($/hour after material), counting sub-components. Lengths are in inches.",
      inputSchema: GetPartInput,
      annotations: { readOnlyHint: true },
    },
    async ({ partId }) => {
      const [part, costs, relations] = await Promise.all([
        Parts.findById(partId),
        Parts.getCostSummary(partId),
        Parts.listRelations(partId),
      ]);
      if (!part) throw new Error(`No part with id ${partId}.`);

      const material = part.material;
      return jsonResult({
        id: part._id.toString(),
        part: part.part,
        revision: part.revision || null,
        description: part.description,
        customer: part.customer
          ? { id: part.customer._id.toString(), name: part.customer.name }
          : null,
        needsReview: part.needsReview,
        stock: part.stock,
        location: part.location || null,
        position: part.position || null,
        price: part.price,
        productLink: part.productLink || null,
        partFilesPath: part.partFilesPath || null,
        material: material
          ? {
              id: material._id.toString(),
              description: material.description,
              kind: material.kind ?? 'stock',
              costPerFoot: material.costPerFoot,
              costPerPiece: material.costPerPiece,
              barLength: material.length,
            }
          : null,
        customerSuppliedMaterial: Boolean(part.customerSuppliedMaterial),
        materialCutType: part.materialCutType,
        materialLength: part.materialLength,
        blanksPerPart: part.blanksPerPart,
        barLength: part.barLength,
        remnantLength: part.remnantLength,
        cycleTimes: part.cycleTimes.map(({ operation, time }) => ({ operation, minutes: time })),
        additionalCosts: part.additionalCosts.map(({ name, cost, url }) => ({
          name,
          cost,
          url: url || null,
        })),
        costs,
        subComponents: relations.subComponents.map(toRelatedPart),
        usedInAssemblies: relations.parents.map(toRelatedPart),
        createdAt: part.createdAt,
      });
    },
  );
}

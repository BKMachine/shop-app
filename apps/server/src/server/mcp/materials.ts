import type { McpServer } from '@modelcontextprotocol/server';
import {
  buildMaterialDescription,
  formatCrossSectionDimension,
  formatDimension,
  MILLIMETERS_PER_INCH,
  materialPieceForms,
  materials,
  normalizeDimensions,
  normalizePieceName,
} from '@repo/utilities/materials';
import { DEFAULT_BUSINESS_TIME_ZONE } from '@repo/utilities/time';
import { DateTime } from 'luxon';
import * as z from 'zod';
import type { MaterialDoc } from '../../database/lib/material/material_model.js';
import Materials from '../../database/lib/material/material_service.js';
import Suppliers from '../../database/lib/supplier/supplier_service.js';
import mongoObjectId from '../../utilities/mongoObjectId.js';

const dimension = (description: string) => z.number().positive().optional().describe(description);
const dateFormat = `an ISO 8601 date or date-time; a value without an offset is read in ${DEFAULT_BUSINESS_TIME_ZONE}`;
const kindDescription =
  'stock is bar or tube cut to length and priced per foot; piece is a pre-formed blank (molding, casting, ...) priced per piece.';
const materialTypes = Object.keys(materials);
// Inches. Sizes this close are treated as possibly the same material, e.g. a tube wall recorded a
// few thousandths off.
const SIZE_TOLERANCE = 0.01;

const FindMaterialsInput = z.object({
  search: z
    .string()
    .optional()
    .describe('Case-insensitive text matched against the description and piece name.'),
  materialType: z
    .string()
    .optional()
    .describe(
      `Material grade, matched exactly (case-insensitive). Known grades: ${materialTypes.join(', ')}.`,
    ),
  kind: z.enum(['stock', 'piece']).optional().describe(kindDescription),
  type: z.enum(['Round', 'Flat']).optional().describe('Stock shape.'),
  form: z.enum(materialPieceForms).optional().describe('Piece form.'),
  isMetric: z
    .boolean()
    .optional()
    .describe(
      'Whether the cross-section is metric. When true, the cross-section dimensions given here are millimeters; otherwise inches.',
    ),
  height: dimension('Flat stock thickness. Width and height may be given in either order.'),
  width: dimension('Flat stock width.'),
  diameter: dimension('Round stock outside diameter.'),
  wallThickness: dimension('Tube wall thickness.'),
  length: dimension(
    'Piece length in inches. Stock is priced per foot, so its bar length does not identify it and stock ignores this filter.',
  ),
  supplier: z.string().optional().describe('Case-insensitive supplier name match.'),
  tolerance: z
    .number()
    .min(0)
    .default(SIZE_TOLERANCE)
    .describe(
      'How far, in inches, a size may be off and still match (0.01 in is 0.254 mm). 0 matches sizes exactly.',
    ),
  limit: z.number().int().min(1).max(100).default(25),
});

const ListMaterialsInput = z.object({
  offset: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(250).default(100),
});

const UpdateMaterialCostInput = z
  .object({
    materialId: mongoObjectId.describe('Material id from find_materials.'),
    costPerFoot: z.number().positive().optional().describe('Cost per foot, for stock materials.'),
    costPerPiece: z.number().positive().optional().describe('Cost per piece, for piece materials.'),
    effectiveAt: z
      .string()
      .optional()
      .describe(
        `When the price took effect, as ${dateFormat}. Omit for a change taking effect now. A past time is inserted into the cost history at that point.`,
      ),
    updateCurrent: z
      .boolean()
      .optional()
      .describe(
        "Whether a past price also becomes the material's current cost. By default it does only when it is newer than every recorded change. Required for a material with no recorded history whose current cost differs.",
      ),
  })
  .refine((input) => (input.costPerFoot === undefined) !== (input.costPerPiece === undefined), {
    message: 'Provide exactly one of costPerFoot or costPerPiece.',
  });

const GetMaterialCostHistoryInput = z.object({
  materialId: mongoObjectId.describe('Material id from find_materials.'),
  from: z
    .string()
    .optional()
    .describe(`Start of the range, as ${dateFormat}. Omit for the full history.`),
  to: z
    .string()
    .optional()
    .describe(
      `End of the range, as ${dateFormat}; a date alone includes that whole day. Omit for now.`,
    ),
});

const CreateMaterialFields = z.object({
  kind: z.enum(['stock', 'piece']).describe(kindDescription),
  materialType: z.enum(materialTypes).describe('Material grade.'),
  type: z.enum(['Round', 'Flat']).optional().describe('Stock shape. Required for stock.'),
  form: z.enum(materialPieceForms).optional().describe('Piece form. Required for pieces.'),
  name: z
    .string()
    .trim()
    .max(60)
    .optional()
    .describe('Piece only: tells apart pieces of the same grade and form, e.g. "Trigger Box".'),
  isMetric: z
    .boolean()
    .default(false)
    .describe(
      'Stock only: the cross-section is metric and its dimensions are given in millimeters.',
    ),
  height: dimension('Flat stock thickness. Required for flat stock.'),
  width: dimension('Flat stock width. Required for flat stock.'),
  diameter: dimension('Round stock outside diameter. Required for round stock.'),
  wallThickness: dimension('Tube wall thickness. Omit for solid bar.'),
  length: z
    .number()
    .positive()
    .default(144)
    .describe('Stock only: bar length in inches. It does not identify the material.'),
  supplier: z
    .string()
    .optional()
    .describe('Name of an existing supplier, case-insensitive. Required for stock.'),
  costPerFoot: z.number().positive().optional().describe('Cost per foot, for stock.'),
  costPerPiece: z.number().positive().optional().describe('Cost per piece, for pieces.'),
  effectiveAt: z
    .string()
    .optional()
    .describe(
      `When the initial cost took effect, as ${dateFormat}. It is recorded in the cost history at that time. Omit when unknown.`,
    ),
  confirmDistinct: z
    .boolean()
    .optional()
    .describe(
      `Create it even though an existing material is within ${SIZE_TOLERANCE} in of its size. Only after confirming it really is a different size.`,
    ),
});

type CreateMaterialField = keyof z.infer<typeof CreateMaterialFields>;

const createMaterialShapes: Record<
  'piece' | MaterialShape,
  { label: string; required: CreateMaterialField[]; unused: CreateMaterialField[] }
> = {
  piece: {
    label: 'pieces',
    required: ['form'],
    unused: ['type', 'height', 'width', 'diameter', 'wallThickness', 'costPerFoot'],
  },
  Flat: {
    label: 'flat stock',
    required: ['supplier', 'height', 'width'],
    unused: ['form', 'name', 'diameter', 'costPerPiece'],
  },
  Round: {
    label: 'round stock',
    required: ['supplier', 'diameter'],
    unused: ['form', 'name', 'height', 'width', 'costPerPiece'],
  },
};

const CreateMaterialInput = CreateMaterialFields.superRefine((input, ctx) => {
  const addIssue = (path: CreateMaterialField, message: string) =>
    ctx.addIssue({ code: 'custom', path: [path], message });

  if (input.kind === 'stock' && !input.type) addIssue('type', 'Required for stock.');
  if (input.kind === 'piece' && input.isMetric) addIssue('isMetric', 'Not used for pieces.');
  if (input.effectiveAt && input.costPerFoot === undefined && input.costPerPiece === undefined) {
    addIssue('effectiveAt', 'Only applies with an initial cost.');
  }

  const shape =
    input.kind === 'piece'
      ? createMaterialShapes.piece
      : input.type && createMaterialShapes[input.type];
  if (!shape) return;
  for (const field of shape.required) {
    if (input[field] === undefined) addIssue(field, `Required for ${shape.label}.`);
  }
  for (const field of shape.unused) {
    if (input[field] !== undefined) addIssue(field, `Not used for ${shape.label}.`);
  }
});

// Cross-sections are stored in inches; a metric one is given and reported in millimeters.
function toInches(value: number | undefined, isMetric: boolean | undefined) {
  if (value === undefined) return undefined;
  return isMetric ? value / MILLIMETERS_PER_INCH : value;
}

function toToolMaterial(material: MaterialDoc) {
  const { _id, __v, supplier, ...fields } = material.toObject();
  const populatedSupplier = supplier as unknown as Supplier | null;
  const crossSection = (value: number | null) =>
    fields.isMetric && value != null ? Number(formatCrossSectionDimension(value, true)) : value;
  return {
    id: _id.toString(),
    ...fields,
    height: crossSection(fields.height),
    width: crossSection(fields.width),
    diameter: crossSection(fields.diameter),
    wallThickness: crossSection(fields.wallThickness),
    crossSectionUnit: fields.isMetric ? 'mm' : 'in',
    supplier: populatedSupplier
      ? { id: populatedSupplier._id.toString(), name: populatedSupplier.name }
      : null,
  };
}

// toToolMaterial without empty fields and with just the supplier's name, for long listings.
function toListedMaterial(material: MaterialDoc) {
  const { supplier, ...fields } = toToolMaterial(material);
  return Object.fromEntries(
    Object.entries({ ...fields, supplier: supplier?.name ?? null }).filter(
      ([, value]) => value !== null,
    ),
  );
}

async function findSupplier(name: string) {
  const suppliers = await Suppliers.list();
  const supplier = suppliers.find((s) => s.name.toLowerCase() === name.trim().toLowerCase());
  if (!supplier) {
    throw new Error(
      `No supplier named "${name}". Known suppliers: ${suppliers.map((s) => s.name).join(', ')}.`,
    );
  }
  return supplier;
}

function jsonResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function parseDate(name: string, value: string): DateTime {
  const date = DateTime.fromISO(value, { zone: DEFAULT_BUSINESS_TIME_ZONE });
  if (!date.isValid) {
    throw new Error(`Invalid ${name} "${value}"; use an ISO 8601 date or date-time.`);
  }
  return date;
}

function parseEffectiveAt(value: string | undefined): Date {
  if (!value) return new Date();

  const effectiveAt = parseDate('effectiveAt', value);
  if (effectiveAt.toMillis() > Date.now()) throw new Error('effectiveAt cannot be in the future.');
  return effectiveAt.toJSDate();
}

function parseRange(from: string | undefined, to: string | undefined) {
  const fromDate = from ? parseDate('from', from).toJSDate() : undefined;
  // A date without a time covers that whole day.
  const toDate = to
    ? (to.includes('T') ? parseDate('to', to) : parseDate('to', to).endOf('day')).toJSDate()
    : undefined;
  if (fromDate && toDate && fromDate > toDate) throw new Error('from must be before to.');
  return { fromDate, toDate };
}

export default function registerMaterialTools(server: McpServer, deviceId: string): void {
  server.registerTool(
    'find_materials',
    {
      title: 'Find materials',
      description:
        "Look up materials to check whether one already exists and get its id and current cost. All filters are optional and combined. Sizes match within `tolerance`, closest first; each result's sizeDifference is its largest gap from the sizes given, in inches, and 0 for an exact match. A near match may be the same material recorded slightly off, or a genuinely different size, so weigh it rather than assuming. Stock is identified by grade, shape and cross-section, not bar length. Results give cross-section dimensions in crossSectionUnit and lengths in inches.",
      inputSchema: FindMaterialsInput,
      annotations: { readOnlyHint: true },
    },
    async ({ height, width, diameter, wallThickness, ...filters }) => {
      const { matches, truncated } = await Materials.search({
        ...filters,
        height: toInches(height, filters.isMetric),
        width: toInches(width, filters.isMetric),
        diameter: toInches(diameter, filters.isMetric),
        wallThickness: toInches(wallThickness, filters.isMetric),
      });
      return jsonResult({
        materials: matches.map(({ material, difference }) => ({
          ...toToolMaterial(material),
          sizeDifference: Number(formatDimension(difference)),
        })),
        truncated,
      });
    },
  );

  server.registerTool(
    'list_materials',
    {
      title: 'List materials',
      description:
        'Page through every material in a compact form, sorted by grade, shape and then size so materials of nearly the same size sit next to each other. Use it to review the whole list, e.g. for materials that look like duplicates. Empty fields are left out; cross-section dimensions are in crossSectionUnit and lengths in inches.',
      inputSchema: ListMaterialsInput,
      annotations: { readOnlyHint: true },
    },
    async ({ offset, limit }) => {
      const { materials, total } = await Materials.listPage(offset, limit);
      const nextOffset = offset + materials.length;
      return jsonResult({
        total,
        offset,
        nextOffset: nextOffset < total ? nextOffset : null,
        materials: materials.map(toListedMaterial),
      });
    },
  );

  server.registerTool(
    'create_material',
    {
      title: 'Create material',
      description: `Add a new material; its description is generated from the fields. Check find_materials first. Stock matches an existing material on grade, shape and cross-section (not bar length or supplier), and a piece on grade, form, name and size. An exact match is refused; one within ${SIZE_TOLERANCE} in is refused unless confirmDistinct is set. Record older prices afterwards with update_material_cost.`,
      inputSchema: CreateMaterialInput,
    },
    async (input) => {
      const isPiece = input.kind === 'piece';
      const isMetric = !isPiece && input.isMetric;
      const effectiveDate = input.effectiveAt ? parseEffectiveAt(input.effectiveAt) : null;
      const supplier = input.supplier ? await findSupplier(input.supplier) : null;

      const material: MaterialCreate = normalizeDimensions({
        description: '',
        kind: input.kind,
        type: input.type ?? null,
        form: input.form ?? null,
        name: normalizePieceName(input.name),
        isMetric,
        height: toInches(input.height, isMetric) ?? null,
        width: toInches(input.width, isMetric) ?? null,
        diameter: toInches(input.diameter, isMetric) ?? null,
        wallThickness: toInches(input.wallThickness, isMetric) ?? null,
        length: isPiece ? null : input.length,
        materialType: input.materialType,
        supplier: supplier?._id.toString() ?? null,
        costPerFoot: input.costPerFoot ?? null,
        costPerPiece: input.costPerPiece ?? null,
      });
      material.description = buildMaterialDescription(material);

      const matches = await Materials.findMatches(material, SIZE_TOLERANCE);
      const existing = matches.find((match) => match.exact)?.material;
      if (existing) {
        throw new Error(
          `This material already exists as "${existing.description}" (id ${existing._id}). Use update_material_cost to change its cost.`,
        );
      }
      if (matches.length && !input.confirmDistinct) {
        const nearby = matches
          .map(
            (match) =>
              `"${match.material.description}" (id ${match.material._id}, ${formatDimension(match.difference)} in off)`,
          )
          .join('; ');
        throw new Error(
          `Within ${SIZE_TOLERANCE} in of existing material: ${nearby}. If it is one of these, use that material instead; if it really is a different size, call again with confirmDistinct: true.`,
        );
      }

      const created = await Materials.create(material, deviceId);
      if (effectiveDate) {
        await Materials.recordCost(
          created._id.toString(),
          isPiece ? 'costPerPiece' : 'costPerFoot',
          (input.costPerFoot ?? input.costPerPiece) as number,
          effectiveDate,
          false,
          deviceId,
        );
      }

      await created.populate('supplier');
      return jsonResult({ material: toToolMaterial(created) });
    },
  );

  server.registerTool(
    'update_material_cost',
    {
      title: 'Update material cost',
      description:
        'Record a material price change, now or retroactively. Set costPerFoot for stock materials or costPerPiece for piece materials. A price equal to the one already in effect at that time is not recorded again, so repeating a call is safe.',
      inputSchema: UpdateMaterialCostInput,
      annotations: { destructiveHint: false, idempotentHint: true },
    },
    async ({ materialId, costPerFoot, costPerPiece, effectiveAt, updateCurrent }) => {
      const field = costPerFoot !== undefined ? 'costPerFoot' : 'costPerPiece';
      const cost = (costPerFoot ?? costPerPiece) as number;
      const effectiveDate = parseEffectiveAt(effectiveAt);

      const change = await Materials.recordCost(
        materialId,
        field,
        cost,
        effectiveDate,
        effectiveAt ? updateCurrent : (updateCurrent ?? true),
        deviceId,
      );

      return jsonResult({
        material: toToolMaterial(change.material),
        field,
        cost,
        previousCost: change.previousCost,
        effectiveAt: effectiveDate.toISOString(),
        recorded: change.recorded,
        currentCostUpdated: change.currentCostUpdated,
      });
    },
  );

  server.registerTool(
    'get_material_cost_history',
    {
      title: 'Get material cost history',
      description:
        "List a material's price changes over time, oldest first. Each change's cost holds until the next one; costAtStart is the cost in effect at `from`, and currentCost is the cost now. Prices from before the shop began recording changes appear only if they were backfilled.",
      inputSchema: GetMaterialCostHistoryInput,
      annotations: { readOnlyHint: true },
    },
    async ({ materialId, from, to }) => {
      const { fromDate, toDate } = parseRange(from, to);
      const history = await Materials.getCostHistory(materialId, fromDate, toDate);

      return jsonResult({
        material: toToolMaterial(history.material),
        field: history.field,
        currentCost: history.material[history.field],
        from: fromDate?.toISOString() ?? null,
        to: toDate?.toISOString() ?? null,
        costAtStart: history.costAtStart,
        changes: history.changes.map((change) => ({
          ...change,
          at: change.at.toISOString(),
        })),
      });
    },
  );
}

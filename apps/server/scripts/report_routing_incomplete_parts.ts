import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  hasIncompleteAssemblyLeafCosts,
  hasIncompletePartCostData,
  hasMissingRateInputs,
  isIncompleteRoutingOperation,
} from '@repo/utilities/parts';
import { connect, disconnect } from '../src/database/index.js';
import Part from '../src/database/lib/part/part_model.js';

/**
 * Lists the parts whose cost data counted as complete before the routing change (0d7d00f) but
 * count as missing data now. Read-only.
 *
 * Before, completeness came from `cycleTimes` (every row needs a name and a time). Now it comes
 * from `routing` (every op also needs a department, ops can be "no cycle time", and an assembly's
 * own routing rows must be complete too). Stored parts keep their legacy `cycleTimes`, so both
 * rules can run on the same documents.
 *
 * Writes a CSV of those parts (id, part, description, why it is incomplete now, link to the part)
 * to `backups/`.
 */

const OUTPUT_DIR = path.join('.', 'backups');
const OUTPUT_PREFIX = 'routing-incomplete-parts';
const PART_URL = 'https://app.bkmachine.net/parts/database/';

/**
 * A CSV cell is plain text, so spreadsheets don't make a bare URL clickable on import; a HYPERLINK
 * formula opens as a link in Excel, Google Sheets and LibreOffice.
 */
function partLink(id: string) {
  const url = `${PART_URL}${id}?tab=cost`;
  return `=HYPERLINK("${url}","${url}")`;
}

function createOutputPath() {
  const timestamp = new Date()
    .toISOString()
    .replace('T', '-')
    .replace(/\..+/, '')
    .replaceAll(':', '-');

  mkdirSync(OUTPUT_DIR, { recursive: true });

  return path.join(OUTPUT_DIR, `${OUTPUT_PREFIX}-${timestamp}.csv`);
}

function escapeCsvCell(value: string) {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

interface LegacyCycleTime {
  operation?: string | null;
  time?: number | null;
}

interface RawPart {
  _id: string;
  part?: string;
  description?: string;
  price?: number | null;
  material?: unknown;
  customerSuppliedMaterial?: boolean;
  additionalCosts?: Array<{ cost?: number | null }> | null;
  cycleTimes?: LegacyCycleTime[] | null;
  routing?: RoutingOperation[] | null;
  subComponentIds?: unknown;
  hasSubComponents?: boolean;
  derived?: { directParentCount?: number | null } | null;
}

function subComponentIdsOf(part: RawPart): string[] {
  if (!Array.isArray(part.subComponentIds)) return [];
  return part.subComponentIds.map((entry) =>
    entry && typeof entry === 'object' && 'partId' in entry ? String(entry.partId) : String(entry),
  );
}

function hasDirectParent(part: RawPart): boolean {
  return Number(part.derived?.directParentCount) > 0;
}

function hasSubComponents(part: RawPart): boolean {
  return part.hasSubComponents === true || subComponentIdsOf(part).length > 0;
}

/* --- The rules as they were before 0d7d00f, on `cycleTimes`. --- */

function legacyHasMissingRateInputs(part: RawPart): boolean {
  const cycleTimes = part.cycleTimes || [];
  const hasCycleTimes = cycleTimes.some((cycle) => Number(cycle.time) > 0);
  const hasIncompleteCycleTimeEntry = cycleTimes.some((cycle) => {
    const operationName = cycle.operation?.trim() || '';
    return !operationName || !(Number(cycle.time) > 0);
  });
  const hasAdditionalCost = (part.additionalCosts || []).some((cost) => Number(cost.cost) > 0);
  const isMissingMaterial = !part.material && !part.customerSuppliedMaterial;

  return (!hasCycleTimes && !hasAdditionalCost) || hasIncompleteCycleTimeEntry || isMissingMaterial;
}

function legacyHasIncompleteLeafCosts(
  part: RawPart,
  partsById: Map<string, RawPart>,
  visited = new Set<string>(),
): boolean {
  if (visited.has(part._id)) return false;
  const nextVisited = new Set(visited).add(part._id);

  for (const id of subComponentIdsOf(part)) {
    const subComponent = partsById.get(id);
    if (!subComponent) continue;
    if (subComponentIdsOf(subComponent).length) {
      if (legacyHasIncompleteLeafCosts(subComponent, partsById, nextVisited)) return true;
      continue;
    }
    if (legacyHasMissingRateInputs(subComponent)) return true;
  }
  return false;
}

function legacyHasIncompleteCostData(part: RawPart, partsById: Map<string, RawPart>): boolean {
  if (!Number(part.price)) return !hasDirectParent(part);
  if (hasSubComponents(part)) return legacyHasIncompleteLeafCosts(part, partsById);
  return legacyHasMissingRateInputs(part);
}

/* --- The current rules, on `routing`, with the assembly flag recomputed rather than stored. --- */

function currentHasIncompleteCostData(part: RawPart, partsById: Map<string, RawPart>): boolean {
  const asInput = (candidate: RawPart) => ({ ...candidate, _id: String(candidate._id) });
  const hasIncompleteSubComponentCosts = hasIncompleteAssemblyLeafCosts(asInput(part), (id) => {
    const subComponent = partsById.get(id);
    return subComponent ? asInput(subComponent) : undefined;
  });
  return hasIncompletePartCostData({
    ...asInput(part),
    derived: { ...part.derived, hasIncompleteSubComponentCosts },
  });
}

/** Why a part is incomplete under the current rules, for `--details`. */
function currentReasons(part: RawPart, partsById: Map<string, RawPart>): string[] {
  const reasons: string[] = [];
  for (const operation of part.routing || []) {
    if (!isIncompleteRoutingOperation(operation)) continue;
    const label = `OP${operation.op}${operation.operation ? ` ${operation.operation}` : ''}`;
    if (!operation.operation?.trim()) reasons.push(`${label}: no name`);
    else if (!operation.department?.trim()) reasons.push(`${label}: no department`);
    else reasons.push(`${label}: no cycle time`);
  }
  if (hasSubComponents(part)) {
    const incompleteChildren = subComponentIdsOf(part).filter((id) => {
      const child = partsById.get(id);
      if (!child) return false;
      return subComponentIdsOf(child).length
        ? hasIncompleteAssemblyLeafCosts(child, (childId) => partsById.get(childId))
        : hasMissingRateInputs(child);
    });
    if (incompleteChildren.length) {
      reasons.push(`sub-components incomplete: ${incompleteChildren.join(',')}`);
    }
  }
  if (!part.routing?.length && part.cycleTimes?.length) reasons.push('no routing');
  return reasons.length ? reasons : ['other'];
}

async function main() {
  await connect();

  try {
    // The raw collection, since the schema no longer has the legacy `cycleTimes`.
    const parts = (await Part.collection
      .find(
        {},
        {
          projection: {
            part: 1,
            description: 1,
            price: 1,
            material: 1,
            customerSuppliedMaterial: 1,
            additionalCosts: 1,
            cycleTimes: 1,
            routing: 1,
            subComponentIds: 1,
            hasSubComponents: 1,
            derived: 1,
          },
        },
      )
      .toArray()) as unknown as RawPart[];

    const partsById = new Map(
      parts.map((part) => {
        const normalized = { ...part, _id: String(part._id) };
        return [normalized._id, normalized];
      }),
    );

    const newlyIncomplete = [...partsById.values()].filter(
      (part) =>
        // Parts made after the routing change never had cycle times to judge them by.
        part.cycleTimes !== undefined &&
        !legacyHasIncompleteCostData(part, partsById) &&
        currentHasIncompleteCostData(part, partsById),
    );

    newlyIncomplete.sort((left, right) =>
      (left.part ?? '').localeCompare(right.part ?? '', undefined, { numeric: true }),
    );

    const lines = [['id', 'part', 'description', 'reasons', 'link'].join(',')];
    for (const part of newlyIncomplete) {
      lines.push(
        [
          part._id,
          part.part ?? '',
          part.description ?? '',
          currentReasons(part, partsById).join('; '),
          partLink(part._id),
        ]
          .map(escapeCsvCell)
          .join(','),
      );
    }

    const outputPath = createOutputPath();
    writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf-8');

    console.log(
      `${newlyIncomplete.length} of ${partsById.size} parts were complete before the routing change and are missing data now.`,
    );
    console.log(`Saved report to ${outputPath}`);
  } finally {
    await disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { connect, disconnect } from '../src/database/index.js';
import Tool from '../src/database/lib/tool/tool_model.js';

const GLOBALS = {
  STALE_DAYS: 720, // 2 years
  OUTPUT_DIR: path.join('.', 'backups'),
  OUTPUT_PREFIX: 'stale-tools',
} as const;

type StaleToolRow = Pick<
  ToolFields,
  'item' | 'description' | 'location' | 'position' | 'stockLastUpdatedAt'
> & {
  _id: string;
};

function getStaleCutoff() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - GLOBALS.STALE_DAYS);
  return cutoff.toISOString();
}

function formatCutoffDate(cutoff: string) {
  return cutoff.slice(0, 10);
}

function createOutputPath() {
  const timestamp = new Date()
    .toISOString()
    .replace('T', '-')
    .replace(/\..+/, '')
    .replaceAll(':', '-');

  mkdirSync(GLOBALS.OUTPUT_DIR, { recursive: true });

  return path.join(GLOBALS.OUTPUT_DIR, `${GLOBALS.OUTPUT_PREFIX}-${timestamp}.csv`);
}

function escapeCsvCell(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

async function main() {
  await connect();

  try {
    const cutoff = getStaleCutoff();
    const tools = await Tool.find(
      {
        $or: [
          { stockLastUpdatedAt: { $lt: cutoff } },
          { stockLastUpdatedAt: null },
          { stockLastUpdatedAt: { $exists: false } },
        ],
      },
      '_id item description location position stockLastUpdatedAt',
    )
      .sort({ item: 1, _id: 1 })
      .lean<StaleToolRow[]>();

    if (!tools.length) {
      console.log(`No stale tools found for stock changes older than ${formatCutoffDate(cutoff)}.`);
      return;
    }

    const outputPath = createOutputPath();
    const header = ['id', 'item', 'description', 'location', 'position', 'stockLastUpdatedAt'];
    const lines = [header.join(',')];

    for (const tool of tools) {
      lines.push(
        [
          String(tool._id),
          tool.item || '',
          tool.description || '',
          tool.location || '',
          tool.position || '',
          tool.stockLastUpdatedAt || '',
        ]
          .map((value) => escapeCsvCell(value))
          .join(','),
      );
    }

    writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf-8');

    console.log(
      `Found ${tools.length} stale tools with stock changes older than ${formatCutoffDate(cutoff)}.`,
    );
    console.log(`Saved report to ${outputPath}`);

    console.table(
      tools.map((tool) => ({
        id: String(tool._id),
        item: tool.item || '',
        description: tool.description || '',
        location: tool.location || '',
        position: tool.position || '',
        stockLastUpdatedAt: tool.stockLastUpdatedAt || '',
      })),
    );
  } finally {
    await disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

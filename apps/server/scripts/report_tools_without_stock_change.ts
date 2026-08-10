import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Types } from 'mongoose';
import { connect, disconnect } from '../src/database/index.js';
import Audit from '../src/database/lib/audit/audit_model.js';
import Tool from '../src/database/lib/tool/tool_model.js';

type ToolSummary = Pick<ToolFields, 'item' | 'description' | 'location' | 'position'> & {
  _id: Types.ObjectId;
};

type ToolAuditSnapshot = {
  timestamp?: Date | string | null;
  old?: {
    _id?: Types.ObjectId | string;
    stock?: number | null;
  } | null;
  new?: {
    _id?: Types.ObjectId | string;
    stock?: number | null;
  } | null;
};

type ReportRow = {
  id: string;
  item: string;
  description: string;
  location: string;
  position: string;
};

function getOneYearAgo() {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  return cutoff.toISOString();
}

function createOutputPath() {
  const timestamp = new Date()
    .toISOString()
    .replace('T', '-')
    .replace(/\..+/, '')
    .replaceAll(':', '-');

  const outputDir = path.join('.', 'backups');
  mkdirSync(outputDir, { recursive: true });

  return path.join(outputDir, `tools-without-stock-change-${timestamp}.csv`);
}

function escapeCsvCell(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

function buildToolAuditQuery(
  toolId: Types.ObjectId,
  timestamp: Record<'$gte', string> | Record<'$lt', string>,
) {
  return {
    type: 'tool' as const,
    timestamp,
    $or: [{ 'old._id': toolId }, { 'new._id': toolId }],
  };
}

function hasStockChange(audit: ToolAuditSnapshot) {
  const oldStock = audit.old?.stock;
  const newStock = audit.new?.stock;

  return typeof oldStock === 'number' && typeof newStock === 'number' && oldStock !== newStock;
}

async function toolExistedBeforeCutoff(toolId: Types.ObjectId, cutoff: string) {
  const previousAudit = await Audit.findOne(
    buildToolAuditQuery(toolId, { $lt: cutoff }),
    'timestamp',
  )
    .sort({ timestamp: -1, _id: -1 })
    .lean<{ timestamp?: Date | string | null } | null>();

  return Boolean(previousAudit?.timestamp);
}

async function main() {
  await connect();

  try {
    const cutoff = getOneYearAgo();
    const tools = await Tool.find({}, '_id item description location position')
      .sort({ item: 1, _id: 1 })
      .lean<ToolSummary[]>();

    const staleTools: ReportRow[] = [];

    for (const [index, tool] of tools.entries()) {
      const recentAudits = await Audit.find(
        buildToolAuditQuery(tool._id, { $gte: cutoff }),
        'timestamp old._id old.stock new._id new.stock',
      )
        .sort({ timestamp: -1, _id: -1 })
        .lean<ToolAuditSnapshot[]>();

      if (recentAudits.some(hasStockChange)) {
        continue;
      }

      const existedBeforeCutoff = await toolExistedBeforeCutoff(tool._id, cutoff);
      if (!existedBeforeCutoff) {
        continue;
      }

      staleTools.push({
        id: String(tool._id),
        item: tool.item || '',
        description: tool.description || '',
        location: tool.location || '',
        position: tool.position || '',
      });

      if ((index + 1) % 200 === 0) {
        console.log(`Checked ${index + 1} of ${tools.length} tools...`);
      }
    }

    const outputPath = createOutputPath();
    const header = ['id', 'item', 'description', 'location', 'position'];
    const lines = [header.join(',')];

    for (const tool of staleTools) {
      lines.push(
        [tool.id, tool.item, tool.description, tool.location, tool.position]
          .map((value) => escapeCsvCell(value))
          .join(','),
      );
    }

    writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf-8');

    console.log(
      `Found ${staleTools.length} tools with no stock change since ${cutoff.slice(0, 10)}.`,
    );
    console.log(`Saved report to ${outputPath}`);

    if (staleTools.length) {
      console.table(staleTools);
    }
  } finally {
    await disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

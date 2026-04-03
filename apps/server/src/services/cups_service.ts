import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import logger from '../logger.js';

const execFileAsync = promisify(execFile);

const enabled = process.env.CUPS_PRINT_ENABLED === 'true';
const cupsServer = process.env.CUPS_SERVER?.trim() || null;
const locationQueue = process.env.CUPS_LOCATION_QUEUE || 'label_small';
const itemQueue = process.env.CUPS_ITEM_QUEUE || 'label_item';
const cupsCommandEnv = cupsServer ? { ...process.env, CUPS_SERVER: cupsServer } : process.env;

function sanitizeJobSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'label';
}

function logConfiguration() {
  logger.info(
    `CUPS config: enabled=${enabled} server=${cupsServer || 'default/local'} locationQueue=${locationQueue} itemQueue=${itemQueue}`,
  );
}

async function sendPdfToQueue(queue: string, pdf: Buffer, jobName: string) {
  const filename = path.join(tmpdir(), `${randomUUID()}.pdf`);

  await writeFile(filename, pdf);

  try {
    logger.info(
      `Submitting CUPS job "${jobName}" to queue "${queue}" via ${cupsServer || 'default/local'}`,
    );
    const { stdout, stderr } = await execFileAsync('lp', ['-d', queue, '-t', jobName, filename], {
      env: cupsCommandEnv,
    });

    if (stdout.trim()) logger.info(`CUPS stdout: ${stdout.trim()}`);
    if (stderr.trim()) logger.warn(`CUPS stderr: ${stderr.trim()}`);
  } finally {
    await unlink(filename).catch(() => {});
  }
}

async function printLocationLabel(pdf: Buffer, data: PrintLocationBody) {
  if (!enabled) return;

  const jobName = `location-${sanitizeJobSegment(data.loc)}-${sanitizeJobSegment(data.pos)}`;
  await sendPdfToQueue(locationQueue, pdf, jobName);
}

async function printItemLabel(pdf: Buffer, data: PrintItemBody) {
  if (!enabled) return;

  const jobName = `item-${sanitizeJobSegment(data.item)}`;
  await sendPdfToQueue(itemQueue, pdf, jobName);
}

logConfiguration();

export default {
  isEnabled: enabled,
  printLocationLabel,
  printItemLabel,
};

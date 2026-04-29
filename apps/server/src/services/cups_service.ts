import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { PDFDocument } from 'pdf-lib';
import logger from '../logger.js';

const execFileAsync = promisify(execFile);
const POINTS_PER_INCH = 72;
const PDF_SIZE_TOLERANCE_POINTS = 0.5;

const enabled = process.env.CUPS_PRINT_ENABLED === 'true';
const cupsServer = process.env.CUPS_SERVER?.trim() || null;
const locationQueue = process.env.CUPS_LOCATION_QUEUE || 'label_small';
const addressQueue = process.env.CUPS_ADDRESS_QUEUE || process.env.CUPS_ITEM_QUEUE || 'label_item';
const locationMedia = process.env.CUPS_LOCATION_MEDIA?.trim() || '30333';
const addressMedia =
  process.env.CUPS_ADDRESS_MEDIA?.trim() || process.env.CUPS_ITEM_MEDIA?.trim() || '30252';
const cupsCommandEnv = cupsServer ? { ...process.env, CUPS_SERVER: cupsServer } : process.env;

type LabelDefinition = {
  kind: 'location' | 'address';
  queue: string;
  media: string;
  widthPoints: number;
  heightPoints: number;
};

const locationLabel: LabelDefinition = {
  kind: 'location',
  queue: locationQueue,
  media: locationMedia,
  widthPoints: 1.0 * POINTS_PER_INCH,
  heightPoints: 1.0 * POINTS_PER_INCH,
};

const addressLabel: LabelDefinition = {
  kind: 'address',
  queue: addressQueue,
  media: addressMedia,
  widthPoints: 3.5 * POINTS_PER_INCH,
  heightPoints: 1.125 * POINTS_PER_INCH,
};

function sanitizeJobSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'label';
}

function pointsToInches(value: number) {
  return (value / POINTS_PER_INCH).toFixed(3);
}

function roughlyEqual(left: number, right: number) {
  return Math.abs(left - right) <= PDF_SIZE_TOLERANCE_POINTS;
}

function matchesLabelSize(width: number, height: number, label: LabelDefinition) {
  const matchesExpectedOrientation =
    roughlyEqual(width, label.widthPoints) && roughlyEqual(height, label.heightPoints);
  const matchesRotatedOrientation =
    roughlyEqual(width, label.heightPoints) && roughlyEqual(height, label.widthPoints);

  return matchesExpectedOrientation || matchesRotatedOrientation;
}

function describeLabel(label: LabelDefinition) {
  return `${label.widthPoints}x${label.heightPoints}pt (${pointsToInches(label.widthPoints)}x${pointsToInches(label.heightPoints)}in)`;
}

function buildLpArgs(label: LabelDefinition, filename: string, jobName: string) {
  const args: string[] = [];

  if (cupsServer) {
    args.push('-h', cupsServer);
  }

  args.push(
    '-d',
    label.queue,
    '-t',
    jobName,
    '-o',
    `media=${label.media}`,
    '-o',
    'scaling=100',
    '-o',
    'fit-to-page=false',
    '-o',
    'page-left=0',
    '-o',
    'page-right=0',
    '-o',
    'page-top=0',
    '-o',
    'page-bottom=0',
    filename,
  );

  return args;
}

async function validatePdfSize(pdf: Buffer, label: LabelDefinition) {
  const document = await PDFDocument.load(pdf);

  if (document.getPageCount() !== 1) {
    throw new Error(
      `Refusing ${label.kind} label print because the PDF has ${document.getPageCount()} pages; expected exactly 1 page for media ${label.media}.`,
    );
  }

  const page = document.getPage(0);
  const { width, height } = page.getSize();

  if (!matchesLabelSize(width, height, label)) {
    throw new Error(
      `Refusing ${label.kind} label print because PDF page size ${width.toFixed(2)}x${height.toFixed(2)}pt does not match expected ${describeLabel(label)} for media ${label.media}.`,
    );
  }
}

function logConfiguration() {
  logger.info(
    `CUPS config: enabled=${enabled} server=${cupsServer || 'default/local'} locationQueue=${locationQueue} locationMedia=${locationMedia} addressQueue=${addressQueue} addressMedia=${addressMedia}`,
  );
}

async function sendPdfToQueue(label: LabelDefinition, pdf: Buffer, jobName: string) {
  const filename = path.join(tmpdir(), `${randomUUID()}.pdf`);

  await validatePdfSize(pdf, label);
  await writeFile(filename, pdf);

  try {
    const args = buildLpArgs(label, filename, jobName);

    logger.info(
      `Submitting CUPS job "${jobName}" to queue "${label.queue}" via ${cupsServer || 'default/local'} with media=${label.media} size=${describeLabel(label)}`,
    );
    const { stdout, stderr } = await execFileAsync('lp', args, {
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
  await sendPdfToQueue(locationLabel, pdf, jobName);
}

async function printAddressLabel(pdf: Buffer, data: PrintItemBody) {
  if (!enabled) return;

  const jobName = `address-${sanitizeJobSegment(data.identifier)}`;
  await sendPdfToQueue(addressLabel, pdf, jobName);
}

logConfiguration();

export default {
  isEnabled: enabled,
  printLocationLabel,
  printAddressLabel,
};

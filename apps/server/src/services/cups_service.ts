import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { degrees, PDFDocument } from 'pdf-lib';
import logger from '../logger.js';

const execFileAsync = promisify(execFile);
const POINTS_PER_INCH = 72;
const PDF_SIZE_TOLERANCE_POINTS = 0.5;

const enabled = process.env.CUPS_PRINT_ENABLED === 'true';
const cupsServer = process.env.CUPS_SERVER?.trim() || null;
const locationQueue = process.env.CUPS_LOCATION_QUEUE || 'label_small';
const addressQueue = process.env.CUPS_ADDRESS_QUEUE || process.env.CUPS_ITEM_QUEUE || 'label_item';
const shipmentQtyQueue = process.env.CUPS_SHIPMENT_QTY_QUEUE || 'zebra_4x6';
const locationMedia = process.env.CUPS_LOCATION_MEDIA?.trim() || '30333';
const addressMedia =
  process.env.CUPS_ADDRESS_MEDIA?.trim() || process.env.CUPS_ITEM_MEDIA?.trim() || '30252';
const shipmentQtyMedia = process.env.CUPS_SHIPMENT_QTY_MEDIA?.trim() || 'w288h432';
const shipmentQtyOrientation =
  process.env.CUPS_SHIPMENT_QTY_ORIENTATION?.trim().toLowerCase() || 'portrait';
const rotateShipmentQtyPrint = process.env.CUPS_SHIPMENT_QTY_ROTATE_PRINT === 'true';
const shipmentQtyResolution = process.env.CUPS_SHIPMENT_QTY_RESOLUTION?.trim() || '203dpi';
const shipmentQtyDarkness = process.env.CUPS_SHIPMENT_QTY_DARKNESS?.trim() || '15';
const shipmentQtyMediaType = process.env.CUPS_SHIPMENT_QTY_MEDIA_TYPE?.trim() || 'Direct';
const shipmentQtyPrintRate = process.env.CUPS_SHIPMENT_QTY_PRINT_RATE?.trim() || '2';
const cupsCommandEnv = cupsServer ? { ...process.env, CUPS_SERVER: cupsServer } : process.env;

type LabelDefinition = {
  kind: 'location' | 'address' | 'shipment-qty';
  queue: string;
  media: string;
  widthPoints: number;
  heightPoints: number;
  orientationRequested?: 3 | 4;
  rotateForPrint?: boolean;
  extraPrintOptions?: string[];
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

const shipmentQtyLabel: LabelDefinition = {
  kind: 'shipment-qty',
  queue: shipmentQtyQueue,
  media: shipmentQtyMedia,
  widthPoints: 4.0 * POINTS_PER_INCH,
  heightPoints: 6.0 * POINTS_PER_INCH,
  orientationRequested: shipmentQtyOrientation === 'landscape' ? 4 : 3,
  rotateForPrint: rotateShipmentQtyPrint,
  extraPrintOptions: [
    `Resolution=${shipmentQtyResolution}`,
    `Darkness=${shipmentQtyDarkness}`,
    `MediaType=${shipmentQtyMediaType}`,
    `zePrintRate=${shipmentQtyPrintRate}`,
  ],
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
  );

  if (label.orientationRequested) {
    args.push('-o', `orientation-requested=${label.orientationRequested}`);
  }

  for (const option of label.extraPrintOptions || []) {
    args.push('-o', option);
  }

  args.push(filename);

  return args;
}

async function rotatePdfClockwise(pdf: Buffer) {
  const sourceDocument = await PDFDocument.load(pdf);
  const rotatedDocument = await PDFDocument.create();

  for (const page of sourceDocument.getPages()) {
    const { width, height } = page.getSize();
    const embeddedPage = await rotatedDocument.embedPage(page);
    const rotatedPage = rotatedDocument.addPage([height, width]);
    rotatedPage.drawPage(embeddedPage, {
      x: height,
      y: 0,
      width,
      height,
      rotate: degrees(90),
    });
  }

  return Buffer.from(await rotatedDocument.save());
}

async function preparePdfForPrint(label: LabelDefinition, pdf: Buffer) {
  if (label.rotateForPrint) {
    return rotatePdfClockwise(pdf);
  }

  return pdf;
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
    `CUPS config: enabled=${enabled} server=${cupsServer || 'default/local'} locationQueue=${locationQueue} locationMedia=${locationMedia} addressQueue=${addressQueue} addressMedia=${addressMedia} shipmentQtyQueue=${shipmentQtyQueue} shipmentQtyMedia=${shipmentQtyMedia} shipmentQtyOrientation=${shipmentQtyOrientation} rotateShipmentQtyPrint=${rotateShipmentQtyPrint} shipmentQtyResolution=${shipmentQtyResolution} shipmentQtyDarkness=${shipmentQtyDarkness} shipmentQtyMediaType=${shipmentQtyMediaType} shipmentQtyPrintRate=${shipmentQtyPrintRate}`,
  );
}

async function sendPdfToQueue(label: LabelDefinition, pdf: Buffer, jobName: string) {
  const filename = path.join(tmpdir(), `${randomUUID()}.pdf`);
  const printablePdf = await preparePdfForPrint(label, pdf);

  await validatePdfSize(printablePdf, label);
  await writeFile(filename, printablePdf);

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

async function printShipmentQtyLabel(pdf: Buffer, data: PrintShipmentQtyLabelBody) {
  if (!enabled) return;

  const jobName = `shipment-qty-${sanitizeJobSegment(data.title || data.subtitle || 'label')}`;
  await sendPdfToQueue(shipmentQtyLabel, pdf, jobName);
}

logConfiguration();

export default {
  isEnabled: enabled,
  printLocationLabel,
  printAddressLabel,
  printShipmentQtyLabel,
};

import { calculatePartsPerBar } from '@repo/utilities/parts';
import { Router } from 'express';
import { isValidId } from '../../../database/index.js';
import Jobs from '../../../database/lib/job/job_service.js';
import MiscSettings from '../../../database/lib/misc_settings/misc_settings_service.js';
import Part from '../../../database/lib/part/part_model.js';
import logger from '../../../logger.js';
import CupsService from '../../../services/cups_service.js';
import {
  buildItemLabel,
  buildJobTravelerPdf,
  buildLocationLabel,
  buildShipmentQtyLabel,
} from '../../../services/image_processor_client.js';
import { getEntityId } from '../../../utilities/entities.js';
import HttpError from '../../middleware/httpError.js';
import { assertKnownDevice, requireKnownDevice } from '../../middleware/knownDevices.js';

const router: Router = Router();

function formatTravelerDate(value: string | Date | null | undefined) {
  if (!value) return '';

  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${Number(match[2])}/${Number(match[3])}/${match[1]}`;
    }
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}/${date.getUTCFullYear()}`;
}

function priorityLabel(priority: JobPriority | undefined) {
  if (priority === 'rush') return 'Rush';
  if (priority === 'low') return 'Low';
  return 'Normal';
}

function normalizeTravelerText(value: string) {
  return value
    .replaceAll('⌀', ' dia ')
    .replaceAll('Ø', ' dia ')
    .replaceAll('ø', ' dia ')
    .replace(/\s+/g, ' ')
    .trim();
}

function materialSummary(part: Part | null) {
  if (!part) return '';
  if (part.customerSuppliedMaterial) return 'Customer Supplied';

  const material = typeof part.material === 'string' ? null : part.material;
  if (!material) return '';

  return normalizeTravelerText(
    [material.materialType, material.description].filter(Boolean).join(' - '),
  );
}

function estimatedMaterialUsage(job: Job, part: Part | null) {
  if (!part || typeof part.material === 'string' || !part.material) return '';

  const fullBarLength = Number(part.material.length) || 0;
  const partsPerBar = calculatePartsPerBar(part, fullBarLength);
  const qty = Math.max(1, Number(job.qty) || 1);

  if (!partsPerBar) return '';

  return `${(qty / partsPerBar).toFixed(1)} bars`;
}

function buildTravelerRows(job: Job, part: Part | null): PrintJobTravelerBody {
  const customer = typeof job.customer === 'string' ? null : job.customer;
  const jobPart = typeof job.part === 'string' ? null : job.part;
  const resolvedPart = part ?? jobPart;

  const jobDetails: PrintJobTravelerRow[] = [
    { label: 'Customer', value: job.customerName || customer?.name || '' },
    { label: 'Part', value: job.partNumber || (resolvedPart?.part ?? '') },
    { label: 'Description', value: job.partDescription || (resolvedPart?.description ?? '') },
    { label: 'Revision', value: job.partRevision || (resolvedPart?.revision ?? '') },
    { label: 'Qty', value: String(Math.max(1, Number(job.qty) || 1)) },
    { label: 'Priority', value: priorityLabel(job.priority) },
    { label: 'Due', value: formatTravelerDate(job.dueDate) },
    { label: 'PO', value: job.customerPo || '' },
  ].filter((row) => row.value);

  const partDetails: PrintJobTravelerRow[] = [
    { label: 'Material', value: materialSummary(resolvedPart) },
    {
      label: 'Cut Type',
      value: resolvedPart?.materialCutType === 'bars' ? 'Bars' : resolvedPart ? 'Blanks' : '',
    },
    {
      label: 'Material Length',
      value: resolvedPart?.materialLength ? String(resolvedPart.materialLength) : '',
    },
    { label: 'Bar Length', value: resolvedPart?.barLength ? String(resolvedPart.barLength) : '' },
    {
      label: 'Remnant Length',
      value: resolvedPart?.remnantLength ? String(resolvedPart.remnantLength) : '',
    },
    { label: 'Estimated Material', value: estimatedMaterialUsage(job, resolvedPart) },
    { label: 'Location', value: resolvedPart?.location || '' },
    { label: 'Position', value: resolvedPart?.position || '' },
  ].filter((row) => row.value);

  return {
    jobNumber: job.jobNumber,
    barcodeText: `bk-job:${job._id}`,
    partImageUrl: resolvedPart?.img?.trim() || undefined,
    jobDetails,
    partDetails,
    operatorNotes: job.notes || '',
  };
}

router.post('/print/location', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { loc, pos }: PrintLocationBody = req.body;
  if (!loc || !pos) return next(new HttpError(400, 'loc and pos are required.'));

  try {
    const pdf = await buildLocationLabel({ loc, pos });
    await CupsService.printLocationLabel(pdf.buffer, { loc, pos }).catch((error) => {
      logger.warn(
        `CUPS location print failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="location-label-preview.pdf"');
    res.status(200).send(pdf.buffer);
  } catch (e) {
    next(e);
  }
});

router.post('/print/item', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { identifier, description, entity, loc, pos, imageUrl, qrText }: PrintItemBody = req.body;
  if (!identifier || !description || !entity || !loc || !pos || !qrText) {
    return next(
      new HttpError(400, 'identifier, description, entity, loc, pos, and qrText are required.'),
    );
  }

  try {
    const miscSettings = await MiscSettings.get();
    const body: PrintItemBody = {
      identifier,
      description,
      entity,
      loc,
      pos,
      qrText,
      imageUrl,
      labelOffsetX: miscSettings.itemLabelOffset.x,
      labelOffsetY: miscSettings.itemLabelOffset.y,
    };
    const pdf = await buildItemLabel(body);
    await CupsService.printAddressLabel(pdf.buffer, body).catch((error) => {
      logger.warn(
        `CUPS part position print failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="part-position-label-preview.pdf"');
    res.status(200).send(pdf.buffer);
  } catch (e) {
    next(e);
  }
});

router.post('/print/shipment-qty', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { title, subtitle, rows }: PrintShipmentQtyLabelBody = req.body;
  const sanitizedRows = Array.isArray(rows)
    ? rows
        .map((row) => ({
          qty: typeof row?.qty === 'string' ? row.qty : '',
          item: typeof row?.item === 'string' ? row.item : '',
        }))
        .filter((row) => row.qty || row.item)
    : [];

  if (!sanitizedRows.length) {
    return next(new HttpError(400, 'At least one qty/item row is required.'));
  }

  const body: PrintShipmentQtyLabelBody = {
    title: typeof title === 'string' ? title : undefined,
    subtitle: typeof subtitle === 'string' ? subtitle : undefined,
    rows: sanitizedRows,
  };

  try {
    const pdf = await buildShipmentQtyLabel(body);
    await CupsService.printShipmentQtyLabel(pdf.buffer, body).catch((error) => {
      logger.warn(
        `CUPS shipment qty print failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="shipment-qty-label-preview.pdf"');
    res.status(200).send(pdf.buffer);
  } catch (e) {
    next(e);
  }
});

router.get('/print/jobs/:id/traveler', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);

  const { id } = req.params;
  if (!isValidId(id)) return next(new HttpError(400, 'Invalid job id'));

  try {
    const job = await Jobs.findById(id);
    if (!job) return next(new HttpError(404, 'Job not found.'));

    const partId = getEntityId(job.part);
    const part =
      partId && isValidId(partId)
        ? ((await Part.findById(partId).populate('material').lean()) as Part | null)
        : null;
    const body = buildTravelerRows(job as unknown as Job, part);

    if (body.partImageUrl) {
      body.partImageUrl = new URL(
        body.partImageUrl,
        `${req.protocol}://${req.get('host')}`,
      ).toString();
    }

    const pdf = await buildJobTravelerPdf(body);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="job-${job.jobNumber}-traveler.pdf"`);
    res.status(200).send(pdf.buffer);
  } catch (e) {
    next(e);
  }
});

export default router;

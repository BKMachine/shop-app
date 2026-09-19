import { Router } from 'express';
import LabelPdfService from '../../../services/label_service/index.js';
import HttpError from '../../middleware/httpError.js';

const router: Router = Router();

router.post('/location', async (req, res, next) => {
  const { loc, pos }: PrintLocationBody = req.body;
  if (!loc || !pos) return next(new HttpError(400, 'loc and pos are required.'));

  try {
    const pdf = await LabelPdfService.buildLocationLabel({ loc, pos });
    res.setHeader('Content-Type', 'application/pdf');
    res.status(200).send(pdf);
  } catch (error) {
    next(error);
  }
});

router.post('/item', async (req, res, next) => {
  const {
    identifier,
    description,
    entity,
    loc,
    pos,
    qrText,
    imageUrl,
    labelOffsetX,
    labelOffsetY,
  }: PrintItemBody = req.body;
  if (!identifier || !description || !entity || !loc || !pos || !qrText) {
    return next(
      new HttpError(400, 'identifier, description, entity, loc, pos, and qrText are required.'),
    );
  }

  try {
    const pdf = await LabelPdfService.buildItemLabel({
      identifier,
      description,
      entity,
      loc,
      pos,
      qrText,
      imageUrl,
      labelOffsetX,
      labelOffsetY,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.status(200).send(pdf);
  } catch (error) {
    next(error);
  }
});

function trimmedStringOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizeLabelValueRows(rows: unknown): PrintJobTravelerRow[] {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => ({
      label: trimmedStringOrEmpty((row as Partial<PrintJobTravelerRow>)?.label),
      value: trimmedStringOrEmpty((row as Partial<PrintJobTravelerRow>)?.value),
    }))
    .filter((row) => row.label && row.value);
}

router.post('/job-traveler', async (req, res, next) => {
  const body = req.body as PrintJobTravelerBody;

  if (!Number.isFinite(body?.jobNumber) || body.jobNumber < 1) {
    return next(new HttpError(400, 'A valid job number is required.'));
  }

  if (!Array.isArray(body?.jobDetails) || !body.jobDetails.length) {
    return next(new HttpError(400, 'At least one job detail row is required.'));
  }

  try {
    const pdf = await LabelPdfService.buildJobTravelerPdf({
      jobNumber: body.jobNumber,
      barcodeText: trimmedStringOrEmpty(body.barcodeText),
      partImageUrl: typeof body.partImageUrl === 'string' ? body.partImageUrl.trim() : undefined,
      jobDetails: sanitizeLabelValueRows(body.jobDetails),
      partDetails: sanitizeLabelValueRows(body.partDetails),
      shipmentPlan: Array.isArray(body.shipmentPlan)
        ? body.shipmentPlan
            .map((shipment) => ({
              shipDate: typeof shipment?.shipDate === 'string' ? shipment.shipDate.trim() : '',
              qty: typeof shipment?.qty === 'string' ? shipment.qty.trim() : '',
              po: typeof shipment?.po === 'string' ? shipment.po.trim() : '',
            }))
            .filter((shipment) => shipment.shipDate && shipment.qty)
        : undefined,
      operatorNotes: typeof body.operatorNotes === 'string' ? body.operatorNotes.trim() : undefined,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.status(200).send(pdf);
  } catch (error) {
    next(error);
  }
});

export default router;

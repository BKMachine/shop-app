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

router.post('/shipment-qty', async (req, res, next) => {
  const { title, subtitle, rows }: PrintShipmentQtyLabelBody = req.body;
  const sanitizedRows = Array.isArray(rows)
    ? rows
        .map((row) => ({
          qty: typeof row?.qty === 'string' ? row.qty.trim() : '',
          item: typeof row?.item === 'string' ? row.item.trim() : '',
        }))
        .filter((row) => row.qty || row.item)
    : [];

  if (!sanitizedRows.length) {
    return next(new HttpError(400, 'At least one qty/item row is required.'));
  }

  try {
    const pdf = await LabelPdfService.buildShipmentQtyLabel({
      title: typeof title === 'string' ? title.trim() : undefined,
      subtitle: typeof subtitle === 'string' ? subtitle.trim() : undefined,
      rows: sanitizedRows,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.status(200).send(pdf);
  } catch (error) {
    next(error);
  }
});

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
      barcodeText: typeof body.barcodeText === 'string' ? body.barcodeText.trim() : '',
      partImageUrl: typeof body.partImageUrl === 'string' ? body.partImageUrl.trim() : undefined,
      jobDetails: body.jobDetails
        .map((row) => ({
          label: typeof row?.label === 'string' ? row.label.trim() : '',
          value: typeof row?.value === 'string' ? row.value.trim() : '',
        }))
        .filter((row) => row.label && row.value),
      partDetails: Array.isArray(body.partDetails)
        ? body.partDetails
            .map((row) => ({
              label: typeof row?.label === 'string' ? row.label.trim() : '',
              value: typeof row?.value === 'string' ? row.value.trim() : '',
            }))
            .filter((row) => row.label && row.value)
        : [],
      operatorNotes: typeof body.operatorNotes === 'string' ? body.operatorNotes.trim() : undefined,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.status(200).send(pdf);
  } catch (error) {
    next(error);
  }
});

export default router;

import { Router } from 'express';
import logger from '../../../logger.js';
import CupsService from '../../../services/cups_service.js';
import LabelPdfService from '../../../services/label_pdf_service.js';
import HttpError from '../../middleware/httpError.js';
import { assertKnownDevice, requireKnownDevice } from '../../middleware/knownDevices.js';

const router: Router = Router();

router.post('/print/location', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { loc, pos }: PrintLocationBody = req.body;
  if (!loc || !pos) return next(new HttpError(400, 'loc and pos are required.'));

  try {
    const pdf = await LabelPdfService.buildLocationLabel({ loc, pos });
    await CupsService.printLocationLabel(pdf, { loc, pos }).catch((error) => {
      logger.warn(
        `CUPS location print failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="location-label-preview.pdf"');
    res.status(200).send(pdf);
  } catch (e) {
    next(e);
  }
});

router.post('/print/item', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { item, description, brand, barcode } = req.body as PrintItemBody & { barcode?: string };
  if (!item || !description) return next(new HttpError(400, 'item and description are required.'));

  try {
    const pdf = await LabelPdfService.buildItemLabel({ item, description, brand, barcode });
    await CupsService.printItemLabel(pdf, { item, description, brand }).catch((error) => {
      logger.warn(
        `CUPS item print failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="item-label-preview.pdf"');
    res.status(200).send(pdf);
  } catch (e) {
    next(e);
  }
});

export default router;

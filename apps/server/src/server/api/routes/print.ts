import { Router } from 'express';
import logger from '../../../logger.js';
import CupsService from '../../../services/cups_service.js';
import { buildItemLabel, buildLocationLabel } from '../../../services/image_processor_client.js';
import HttpError from '../../middleware/httpError.js';
import { assertKnownDevice, requireKnownDevice } from '../../middleware/knownDevices.js';

const router: Router = Router();

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

  const body: PrintItemBody = {
    identifier,
    description,
    entity,
    loc,
    pos,
    qrText,
    imageUrl,
  };

  try {
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

export default router;

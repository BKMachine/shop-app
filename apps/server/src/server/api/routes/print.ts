import { Router } from 'express';
import MiscSettings from '../../../database/lib/misc_settings/misc_settings_service.js';
import logger from '../../../logger.js';
import CupsService from '../../../services/cups_service.js';
import {
  buildItemLabel,
  buildLocationLabel,
  buildShipmentQtyLabel,
} from '../../../services/image_processor_client.js';
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
          qty: typeof row?.qty === 'string' ? row.qty.trim() : '',
          item: typeof row?.item === 'string' ? row.item.trim() : '',
        }))
        .filter((row) => row.qty || row.item)
    : [];

  if (!sanitizedRows.length) {
    return next(new HttpError(400, 'At least one qty/item row is required.'));
  }

  const body: PrintShipmentQtyLabelBody = {
    title: typeof title === 'string' ? title.trim() : undefined,
    subtitle: typeof subtitle === 'string' ? subtitle.trim() : undefined,
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

export default router;

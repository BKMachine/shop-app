import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import * as z from 'zod';
import { isValidId } from '../../../database/index.js';
import ImageService from '../../../database/lib/image/image_service.js';
import Shipments from '../../../database/lib/shipment/shipment_service.js';
import { imageDir } from '../../../directories.js';
import logger from '../../../logger.js';
import mongoObjectId from '../../../utilities/mongoObjectId.js';
import { normalizeQueryValue } from '../../../utilities/normalizeQueryValue.js';
import HttpError from '../../middleware/httpError.js';
import { assertKnownDevice, requireKnownDevice } from '../../middleware/knownDevices.js';

const router: Router = Router();

const ShipmentFieldsSchema = z.strictObject({
  shippedAt: z.coerce.date(),
  customer: mongoObjectId.nullish(),
  shipper: mongoObjectId.nullish(),
  orderNumber: z.string().optional(),
  trackingNumber: z.string().optional(),
  carrier: z.string().optional(),
  notes: z.string().optional(),
  imageIds: z.array(mongoObjectId).optional(),
});

const CreateShipmentRequest = z.strictObject({
  shipment: ShipmentFieldsSchema,
});

const UpdateShipmentRequest = z.strictObject({
  shipment: ShipmentFieldsSchema.extend({
    _id: mongoObjectId,
    __v: z.number().optional(),
  }),
});

function deleteImageFileIfPresent(relPath: string) {
  const filePath = path.join(imageDir, relPath);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

router.get('/shipments', async (req, res, next) => {
  try {
    const data = await Shipments.list({
      from: normalizeQueryValue(req.query.from),
      to: normalizeQueryValue(req.query.to),
      customer: normalizeQueryValue(req.query.customer),
      search: normalizeQueryValue(req.query.search),
      limit: Number(normalizeQueryValue(req.query.limit)),
      offset: Number(normalizeQueryValue(req.query.offset)),
    });
    res.status(200).json(data);
  } catch (e) {
    next(e);
  }
});

router.get('/shipments/:id', async (req, res, next) => {
  const { id } = req.params;
  if (!isValidId(id)) return next(new HttpError(400, 'Invalid shipment id'));

  try {
    const shipment = await Shipments.findById(id);
    if (!shipment) return next(new HttpError(404, 'Shipment not found.'));
    res.status(200).json(shipment);
  } catch (e) {
    next(e);
  }
});

router.post('/shipments', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { success, data, error } = CreateShipmentRequest.safeParse(req.body);
  if (!success) {
    logger.error('Invalid shipment data provided:', error.message);
    return next(new HttpError(400, 'Invalid shipment data.'));
  }

  try {
    const shipment = await Shipments.create(data.shipment, req.deviceId);
    res.status(200).json(shipment);
  } catch (e) {
    next(e);
  }
});

router.put('/shipments', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { success, data, error } = UpdateShipmentRequest.safeParse(req.body);
  if (!success) {
    logger.error('Invalid shipment data provided:', error.message);
    return next(new HttpError(400, 'Invalid shipment data.'));
  }

  try {
    const shipment = await Shipments.update(data.shipment, req.deviceId);
    res.status(200).json(shipment);
  } catch (e) {
    next(e);
  }
});

router.delete('/shipments/:id', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { id } = req.params;
  if (!isValidId(id)) return next(new HttpError(400, 'Invalid shipment id'));

  try {
    const attachedImages = await ImageService.listByEntity('shipment', id);
    for (const image of attachedImages) {
      deleteImageFileIfPresent(image.relPath);
      await ImageService.remove(image._id.toString(), req.deviceId);
    }

    const removed = await Shipments.remove(id, req.deviceId);
    if (!removed) return next(new HttpError(404, 'Shipment not found.'));
    res.status(200).json({ success: true, id });
  } catch (e) {
    next(e);
  }
});

export default router;

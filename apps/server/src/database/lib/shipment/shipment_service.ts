import { isValidObjectId } from 'mongoose';
import { emit } from '../../../server/sockets.js';
import { getEntityIdOrNull, normalizeObjectIdArray } from '../../../utilities/entities.js';
import escapeRegExp from '../../../utilities/escapeRegExp.js';
import Customer from '../customer/customer_model.js';
import Shipper from '../shipper/shipper_model.js';
import Shipment, { type ShipmentDoc } from './shipment_model.js';

type ShipmentListQuery = {
  from?: string;
  to?: string;
  customer?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toPayload(data: ShipmentCreate | ShipmentUpdate) {
  return {
    shippedAt: new Date(data.shippedAt),
    title: normalizeText(data.title),
    customer: getEntityIdOrNull(data.customer),
    shipper: getEntityIdOrNull(data.shipper),
    orderNumber: normalizeText(data.orderNumber),
    trackingNumber: normalizeText(data.trackingNumber),
    carrier: normalizeText(data.carrier),
    notes: normalizeText(data.notes),
    imageIds: normalizeObjectIdArray(data.imageIds),
  };
}

async function list(query: ShipmentListQuery = {}): Promise<ShipmentListResponse> {
  const filter: Record<string, unknown> = {};
  const shippedAt: Record<string, Date> = {};

  if (query.from) shippedAt.$gte = new Date(query.from);
  if (query.to) shippedAt.$lte = new Date(query.to);
  if (Object.keys(shippedAt).length) filter.shippedAt = shippedAt;

  if (query.customer && isValidObjectId(query.customer)) {
    filter.customer = query.customer;
  }

  const search = normalizeText(query.search);
  if (search) {
    const searchRegex = { $regex: escapeRegExp(search), $options: 'i' };
    const [matchingCustomers, matchingShippers] = await Promise.all([
      Customer.find({ name: searchRegex }, '_id'),
      Shipper.find({ name: searchRegex }, '_id'),
    ]);

    filter.$or = [
      { title: searchRegex },
      { orderNumber: searchRegex },
      { trackingNumber: searchRegex },
      { carrier: searchRegex },
      { notes: searchRegex },
      { customer: { $in: matchingCustomers.map((customer) => customer._id) } },
      { shipper: { $in: matchingShippers.map((shipper) => shipper._id) } },
    ];
  }

  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200);
  const offset = Math.max(Number(query.offset) || 0, 0);

  const [items, total] = await Promise.all([
    Shipment.find(filter)
      .populate('customer')
      .populate('shipper')
      .sort({ shippedAt: -1, createdAt: -1 })
      .skip(offset)
      .limit(limit),
    Shipment.countDocuments(filter),
  ]);

  return {
    items: items as unknown as Shipment[],
    total,
    limit,
    offset,
    hasMore: offset + items.length < total,
  };
}

async function findById(id: string): Promise<ShipmentDoc | null> {
  return Shipment.findById(id).populate('customer').populate('shipper');
}

async function create(data: ShipmentCreate, _deviceId: string): Promise<ShipmentDoc> {
  const shipment = new Shipment(toPayload(data));
  await shipment.save();
  const populated = await findById(shipment._id.toString());
  emit('shipment', populated ?? shipment);
  return populated ?? shipment;
}

async function update(data: ShipmentUpdate, _deviceId: string): Promise<ShipmentDoc> {
  const updated = await Shipment.findByIdAndUpdate(data._id, toPayload(data), {
    returnDocument: 'after',
  }).populate('customer');
  await updated?.populate('shipper');
  if (!updated) throw new Error(`Missing shipment document id: ${data._id}`);
  emit('shipment', updated);
  return updated;
}

async function remove(id: string, _deviceId: string): Promise<boolean> {
  const result = await Shipment.findByIdAndDelete(id);
  if (result) emit('shipmentDeleted', { id });
  return Boolean(result);
}

async function addImage(id: string, imageId: string, deviceId: string): Promise<ShipmentDoc> {
  const shipment = await findById(id);
  if (!shipment) throw new Error(`Missing shipment document id: ${id}`);

  const nextIds = normalizeObjectIdArray(shipment.imageIds).filter(
    (existingId) => existingId !== imageId,
  );
  nextIds.push(imageId);

  return update(
    {
      ...(shipment.toObject() as unknown as ShipmentUpdate),
      _id: id,
      customer: getEntityIdOrNull(shipment.customer),
      imageIds: nextIds,
    },
    deviceId,
  );
}

async function removeImage(id: string, imageId: string, deviceId: string): Promise<ShipmentDoc> {
  const shipment = await findById(id);
  if (!shipment) throw new Error(`Missing shipment document id: ${id}`);

  return update(
    {
      ...(shipment.toObject() as unknown as ShipmentUpdate),
      _id: id,
      customer: getEntityIdOrNull(shipment.customer),
      imageIds: normalizeObjectIdArray(shipment.imageIds).filter(
        (existingId) => existingId !== imageId,
      ),
    },
    deviceId,
  );
}

export default {
  list,
  findById,
  create,
  update,
  remove,
  addImage,
  removeImage,
};

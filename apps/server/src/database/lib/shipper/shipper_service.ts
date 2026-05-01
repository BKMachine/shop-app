import { emit } from '../../../server/sockets.js';
import AuditService from '../audit/audit_service.js';
import Shipper, { type ShipperDoc } from './shipper_model.js';

async function list(): Promise<ShipperDoc[]> {
  return Shipper.find({});
}

async function findById(id: string): Promise<ShipperDoc | null> {
  return Shipper.findById(id);
}

async function create(data: ShipperCreate, deviceId: string): Promise<ShipperDoc> {
  const shipper = new Shipper(data);
  await shipper.save();
  await AuditService.addShipperAudit(null, shipper, deviceId);
  emit('shipper', shipper);
  return shipper;
}

async function update(data: ShipperUpdate, deviceId: string): Promise<ShipperDoc> {
  const oldShipper = await Shipper.findById(data._id);
  if (!oldShipper) throw new Error(`Missing shipper document id: ${data._id}`);
  const updatedShipper = await Shipper.findByIdAndUpdate(data._id, data, {
    returnDocument: 'after',
  });
  if (!updatedShipper) throw new Error(`Unable to update shipper document id: ${data._id}`);
  await AuditService.addShipperAudit(oldShipper, updatedShipper, deviceId);
  emit('shipper', updatedShipper);
  return updatedShipper;
}

export default {
  list,
  findById,
  create,
  update,
};

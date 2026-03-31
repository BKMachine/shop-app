import { Types } from 'mongoose';
import { emit } from '../../../server/sockets.js';
import Audit from './audit_model.js';

function normalizeAuditPayload(doc: unknown): unknown | null {
  if (!doc) return null;

  if (typeof doc === 'object' && doc !== null && 'toObject' in doc) {
    const maybeDoc = doc as { toObject?: () => unknown };
    if (typeof maybeDoc.toObject === 'function') {
      return maybeDoc.toObject();
    }
  }

  return doc;
}

async function addAudit(
  type: Audit['type'],
  oldDoc: unknown | null,
  newDoc: unknown | null,
  device: string,
): Promise<void> {
  const doc = new Audit({
    type,
    timestamp: new Date(),
    device: new Types.ObjectId(device),
    old: normalizeAuditPayload(oldDoc),
    new: normalizeAuditPayload(newDoc),
  });
  await doc.save();
  emit('audit');
}

async function addToolAudit(
  oldTool: ToolDoc | null,
  newTool: ToolDoc,
  device: string,
): Promise<void> {
  await addAudit('tool', oldTool, newTool, device);
  emit('tool_audit');
}

async function getToolAudits(id: string, from: string, to: string): Promise<AuditDoc[]> {
  const projection =
    'timestamp device new.stock old.stock new.onOrder old.onOrder new.cost old.cost';

  const docsInRange = await Audit.find(
    {
      type: 'tool',
      'old._id': new Types.ObjectId(id),
      timestamp: { $gte: from, $lte: to },
    },
    projection,
  ).populate('device', 'displayName deviceType');
  if (!docsInRange.length) return [];

  const previousDoc = await Audit.findOne(
    { type: 'tool', 'old._id': new Types.ObjectId(id), timestamp: { $lt: from } },
    projection,
  )
    .sort({
      _id: -1,
    })
    .populate('device', 'displayName deviceType');
  //.lean();
  return previousDoc ? [previousDoc, ...docsInRange] : docsInRange;
}

async function getAllToolAudits(from: string, to: string): Promise<AuditDoc[]> {
  const projection = 'timestamp device new old.stock';

  return Audit.find(
    {
      type: 'tool',
      timestamp: { $gte: from, $lte: to },
    },
    projection,
  ).populate('device', 'displayName deviceType');
}

async function addPartAudit(
  oldPart: PartDoc | null,
  newPart: PartDoc,
  device: string,
): Promise<void> {
  await addAudit('part', oldPart, newPart, device);
  emit('part_audit');
}

async function getPartAudits(id: string, from: string, to: string): Promise<AuditDoc[]> {
  const projection = 'timestamp device new.stock old.stock';
  const docsInRange = await Audit.find(
    {
      type: 'part',
      'old._id': new Types.ObjectId(id),
      timestamp: { $gte: from, $lte: to },
    },
    projection,
  ).populate('device', 'displayName deviceType');
  if (!docsInRange.length) return [];

  const previousDoc = await Audit.findOne(
    { type: 'part', 'old._id': new Types.ObjectId(id), timestamp: { $lt: from } },
    projection,
  )
    .sort({
      _id: -1,
    })
    .populate('device', 'displayName deviceType');
  //.lean();
  return previousDoc ? [previousDoc, ...docsInRange] : docsInRange;
}

async function getAllPartAudits(from: string, to: string): Promise<AuditDoc[]> {
  const projection = 'timestamp device new old.stock';

  return Audit.find(
    {
      type: 'part',
      timestamp: { $gte: from, $lte: to },
    },
    projection,
  ).populate('device', 'displayName deviceType');
}

async function addMaterialAudit(
  oldMaterial: MaterialDoc | null,
  newMaterial: MaterialDoc,
  device: string,
): Promise<void> {
  await addAudit('material', oldMaterial, newMaterial, device);
}

async function addCustomerAudit(
  oldCustomer: CustomerDoc | null,
  newCustomer: CustomerDoc | null,
  device: string,
): Promise<void> {
  await addAudit('customer', oldCustomer, newCustomer, device);
}

async function addSupplierAudit(
  oldSupplier: SupplierDoc | null,
  newSupplier: SupplierDoc | null,
  device: string,
): Promise<void> {
  await addAudit('supplier', oldSupplier, newSupplier, device);
}

async function addVendorAudit(
  oldVendor: VendorDoc | null,
  newVendor: VendorDoc | null,
  device: string,
): Promise<void> {
  await addAudit('vendor', oldVendor, newVendor, device);
}

async function addReportAudit(
  oldReport: EmailReportDoc | null,
  newReport: EmailReportDoc | null,
  device: string,
): Promise<void> {
  await addAudit('report', oldReport, newReport, device);
}

async function addPartNoteAudit(
  oldNote: PartNoteDoc | null,
  newNote: PartNoteDoc | null,
  device: string,
): Promise<void> {
  await addAudit('part_note', oldNote, newNote, device);
}

async function getAllAudits(types?: Audit['type'][], limit = 20, offset = 0): Promise<AuditDoc[]> {
  const query: {
    type?: { $in: Audit['type'][] };
  } = {};

  if (types?.length) {
    query.type = { $in: types };
  }

  return Audit.find(query, 'type timestamp device old new')
    .sort({ timestamp: -1 })
    .skip(offset)
    .limit(limit)
    .populate('device', 'displayName deviceType');
}

export default {
  addAudit,
  addToolAudit,
  getToolAudits,
  addPartAudit,
  getPartAudits,
  getAllToolAudits,
  getAllPartAudits,
  addMaterialAudit,
  addCustomerAudit,
  addSupplierAudit,
  addVendorAudit,
  addReportAudit,
  addPartNoteAudit,
  getAllAudits,
};

import { Types } from 'mongoose';
import { emit } from '../../../server/sockets.js';
import type { CustomerDoc } from '../customer/customer_model.js';
import type { StoredDocumentDoc } from '../document/document_model.js';
import type { ImageDoc } from '../image/image_model.js';
import type { MaterialDoc } from '../material/material_model.js';
import type { PartDoc } from '../part/part_model.js';
import type { PartNoteDoc } from '../part_note/part_note_model.js';
import type { EmailReportDoc } from '../report/report_model.js';
import type { ShipmentDoc } from '../shipment/shipment_model.js';
import type { ShipperDoc } from '../shipper/shipper_model.js';
import type { SupplierDoc } from '../supplier/supplier_model.js';
import type { ToolDoc, ToolPopulatedDoc } from '../tool/tool_model.js';
import type { VendorDoc } from '../vendor/vendor_model.js';
import Audit from './audit_model.js';

const hiddenAuditTypes = new Set<Audit['type']>(['image', 'document']);
const auditBucketMs = 5 * 60 * 1000;

type ActivityAudit = Pick<Audit, '_id' | 'type' | 'timestamp' | 'device' | 'old' | 'new'> & {
  mergedCount?: number;
};
type OpenAuditBucket = {
  startTimeMs: number;
  audit: ActivityAudit;
};
type ActivityAuditPage = {
  items: ActivityAudit[];
  hasMore: boolean;
};

function normalizeAuditPayload(doc: unknown): unknown | null {
  if (!doc) return null;

  if (typeof doc === 'object' && doc !== null && 'toObject' in doc) {
    const maybeDoc = doc as {
      toObject?: (options?: { depopulate?: boolean }) => unknown;
    };
    if (typeof maybeDoc.toObject === 'function') {
      return maybeDoc.toObject({ depopulate: true });
    }
  }

  return doc;
}

function getAuditDeviceId(device: Audit['device'] | string | null | undefined): string {
  if (!device) return 'unknown-device';
  if (typeof device === 'string') return device;
  return device._id || 'unknown-device';
}

function getAuditItemId(audit: Pick<Audit, 'old' | 'new'>): string | null {
  const itemId = audit.new?._id ?? audit.old?._id;
  if (!itemId) return null;
  return String(itemId);
}

function mergeActivityAudits(audits: ActivityAudit[]): ActivityAudit[] {
  const openBuckets = new Map<string, OpenAuditBucket>();
  const mergedAudits: ActivityAudit[] = [];

  for (const audit of [...audits].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  )) {
    const itemId = getAuditItemId(audit);
    if (!itemId) {
      mergedAudits.push(audit);
      continue;
    }

    const key = `${audit.type}:${itemId}:${getAuditDeviceId(audit.device)}`;
    const existing = openBuckets.get(key);
    const auditTimeMs = new Date(audit.timestamp).getTime();

    if (!existing || auditTimeMs - existing.startTimeMs > auditBucketMs) {
      if (existing) mergedAudits.push(existing.audit);
      openBuckets.set(key, {
        startTimeMs: auditTimeMs,
        audit: { ...audit, mergedCount: 1 },
      });
      continue;
    }

    existing.audit = {
      ...existing.audit,
      _id: audit._id,
      timestamp: audit.timestamp,
      new: audit.new,
      mergedCount: (existing.audit.mergedCount ?? 1) + 1,
    };
  }

  for (const bucket of openBuckets.values()) {
    mergedAudits.push(bucket.audit);
  }

  return mergedAudits.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

async function addAudit(
  type: Audit['type'],
  oldDoc: unknown | null,
  newDoc: unknown | null,
  deviceId: string,
): Promise<void> {
  const doc = new Audit({
    type,
    timestamp: new Date(),
    device: new Types.ObjectId(deviceId),
    old: normalizeAuditPayload(oldDoc),
    new: normalizeAuditPayload(newDoc),
  });
  await doc.save();
  emit('audit');
}

async function getAllAudits(
  types?: Audit['type'][],
  limit = 20,
  offset = 0,
): Promise<ActivityAuditPage> {
  const query: {
    type?: { $in?: Audit['type'][]; $nin?: Audit['type'][] };
  } = {};

  if (types?.length) {
    query.type = { $in: types };
  } else {
    query.type = { $nin: Array.from(hiddenAuditTypes) };
  }

  const audits = await Audit.find(query, 'type timestamp device old new')
    .sort({ timestamp: 1, _id: 1 })
    .populate('device', 'displayName deviceType')
    .lean<ActivityAudit[]>();

  const mergedAudits = mergeActivityAudits(audits);

  return {
    items: mergedAudits.slice(offset, offset + limit),
    hasMore: offset + limit < mergedAudits.length,
  };
}

async function addToolAudit(
  oldTool: ToolDoc | ToolPopulatedDoc | null,
  newTool: ToolDoc | ToolPopulatedDoc,
  deviceId: string,
): Promise<void> {
  await addAudit('tool', oldTool, newTool, deviceId);
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

async function getAllToolAudits(from: string, to: string): Promise<ActivityAudit[]> {
  const projection = 'timestamp device new old.stock';

  const audits = await Audit.find(
    {
      type: 'tool',
      timestamp: { $gte: from, $lte: to },
    },
    projection,
  )
    .sort({ timestamp: 1, _id: 1 })
    .populate('device', 'displayName deviceType')
    .lean<ActivityAudit[]>();

  return mergeActivityAudits(audits);
}

async function addPartAudit(
  oldPart: PartDoc | null,
  newPart: PartDoc,
  deviceId: string,
): Promise<void> {
  await addAudit('part', oldPart, newPart, deviceId);
  emit('part_audit');
}

async function addImageAudit(
  oldImage: ImageDoc | null,
  newImage: ImageDoc | null,
  deviceId: string,
): Promise<void> {
  await addAudit('image', oldImage, newImage, deviceId);
}

async function addDocumentAudit(
  oldDocument: StoredDocumentDoc | null,
  newDocument: StoredDocumentDoc | null,
  deviceId: string,
): Promise<void> {
  await addAudit('document', oldDocument, newDocument, deviceId);
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

async function getAllPartAudits(from: string, to: string): Promise<ActivityAudit[]> {
  const projection = 'timestamp device new old.stock';

  const audits = await Audit.find(
    {
      type: 'part',
      timestamp: { $gte: from, $lte: to },
    },
    projection,
  )
    .sort({ timestamp: 1, _id: 1 })
    .populate('device', 'displayName deviceType')
    .lean<ActivityAudit[]>();

  return mergeActivityAudits(audits);
}

async function addMaterialAudit(
  oldMaterial: MaterialDoc | null,
  newMaterial: MaterialDoc | null,
  deviceId: string,
): Promise<void> {
  await addAudit('material', oldMaterial, newMaterial, deviceId);
}

async function addCustomerAudit(
  oldCustomer: CustomerDoc | null,
  newCustomer: CustomerDoc | null,
  deviceId: string,
): Promise<void> {
  await addAudit('customer', oldCustomer, newCustomer, deviceId);
}

async function addSupplierAudit(
  oldSupplier: SupplierDoc | null,
  newSupplier: SupplierDoc | null,
  deviceId: string,
): Promise<void> {
  await addAudit('supplier', oldSupplier, newSupplier, deviceId);
}

async function addShipperAudit(
  oldShipper: ShipperDoc | null,
  newShipper: ShipperDoc | null,
  deviceId: string,
): Promise<void> {
  await addAudit('shipper', oldShipper, newShipper, deviceId);
}

async function addShipmentAudit(
  oldShipment: ShipmentDoc | null,
  newShipment: ShipmentDoc | null,
  deviceId: string,
): Promise<void> {
  await addAudit('shipment', oldShipment, newShipment, deviceId);
}

async function addVendorAudit(
  oldVendor: VendorDoc | null,
  newVendor: VendorDoc | null,
  deviceId: string,
): Promise<void> {
  await addAudit('vendor', oldVendor, newVendor, deviceId);
}

async function addReportAudit(
  oldReport: EmailReportDoc | null,
  newReport: EmailReportDoc | null,
  deviceId: string,
): Promise<void> {
  await addAudit('report', oldReport, newReport, deviceId);
}

async function addPartNoteAudit(
  oldNote: PartNoteDoc | null,
  newNote: PartNoteDoc | null,
  deviceId: string,
): Promise<void> {
  await addAudit('part_note', oldNote, newNote, deviceId);
}

export default {
  addAudit,
  getAllAudits,
  addToolAudit,
  getToolAudits,
  getAllToolAudits,
  addPartAudit,
  getPartAudits,
  getAllPartAudits,
  addImageAudit,
  addDocumentAudit,
  addMaterialAudit,
  addCustomerAudit,
  addSupplierAudit,
  addShipperAudit,
  addShipmentAudit,
  addVendorAudit,
  addReportAudit,
  addPartNoteAudit,
};

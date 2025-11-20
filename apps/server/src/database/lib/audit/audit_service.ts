import { Types } from 'mongoose';
import Audit from './audit_model.js';

async function addToolAudit(oldTool: ToolDoc | null, newTool: ToolDoc): Promise<void> {
  const doc = new Audit({
    type: 'tool',
    timestamp: new Date(),
    old: oldTool,
    new: newTool,
  });
  await doc.save();
}

async function getToolAudits(id: string, from: string, to: string): Promise<AuditDoc[]> {
  const projection = 'timestamp new.stock old.stock new.onOrder old.onOrder, new.cost old.cost';

  const docsInRange = await Audit.find(
    {
      type: 'tool',
      'old._id': new Types.ObjectId(id),
      timestamp: { $gte: from, $lte: to },
    },
    projection,
  );
  if (!docsInRange.length) return [];

  const previousDoc = await Audit.findOne(
    { type: 'tool', 'old._id': new Types.ObjectId(id), timestamp: { $lt: from } },
    projection,
  ).sort({
    _id: -1,
  });
  //.lean();
  return previousDoc ? [previousDoc, ...docsInRange] : docsInRange;
}

async function addPartAudit(oldPart: PartDoc | null, newPart: PartDoc): Promise<void> {
  const doc = new Audit({
    type: 'part',
    timestamp: new Date(),
    old: oldPart,
    new: newPart,
  });
  await doc.save();
}

async function getPartAudits(id: string, from: string, to: string): Promise<AuditDoc[]> {
  const projection = 'timestamp new.stock old.stock';
  const docsInRange = await Audit.find(
    {
      type: 'part',
      'old._id': new Types.ObjectId(id),
      timestamp: { $gte: from, $lte: to },
    },
    projection,
  );
  if (!docsInRange.length) return [];

  const previousDoc = await Audit.findOne(
    { type: 'part', 'old._id': new Types.ObjectId(id), timestamp: { $lt: from } },
    projection,
  ).sort({
    _id: -1,
  });
  //.lean();
  return previousDoc ? [previousDoc, ...docsInRange] : docsInRange;
}

export default {
  addToolAudit,
  getToolAudits,
  addPartAudit,
  getPartAudits,
};

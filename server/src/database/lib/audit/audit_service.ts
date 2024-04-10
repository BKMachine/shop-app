import { Types } from 'mongoose';
import Audit from './audit_model';

async function addToolAudit(oldTool: ToolDoc | null, newTool: ToolDoc) {
  const doc = new Audit({
    type: 'tool',
    timestamp: new Date(),
    old: oldTool,
    new: newTool,
  });
  await doc.save();
}

async function getToolAudits(id: string, from: string, to: string) {
  return Audit.find(
    {
      type: 'tool',
      'old._id': new Types.ObjectId(id),
      timestamp: { $gte: from, $lte: to },
    },
    'timestamp new.stock old.stock',
  );
}

export default {
  addToolAudit,
  getToolAudits,
};

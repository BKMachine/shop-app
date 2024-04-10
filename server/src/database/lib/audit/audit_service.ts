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

export default {
  addToolAudit,
};

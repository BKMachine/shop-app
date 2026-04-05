import Audit from '../audit/audit_service.js';
import Report from './report_model.js';

async function list(): Promise<EmailReportDoc[]> {
  return Report.find();
}

async function create(data: EmailReportDoc, deviceId: string): Promise<EmailReportDoc> {
  const doc = new Report(data);
  await doc.save();
  await Audit.addReportAudit(null, doc, deviceId);
  return doc;
}

async function update(doc: EmailReportDoc, deviceId: string): Promise<EmailReportDoc | null> {
  const oldDoc = await Report.findById(doc._id);
  if (!oldDoc) throw new Error(`Missing report document id: ${doc._id}`);
  const updated = await Report.findByIdAndUpdate(doc._id, doc, { returnDocument: 'after' });
  if (!updated) throw new Error(`Unable to update report document id: ${doc._id}`);
  await Audit.addReportAudit(oldDoc, updated, deviceId);
  return updated;
}

export default {
  list,
  create,
  update,
};

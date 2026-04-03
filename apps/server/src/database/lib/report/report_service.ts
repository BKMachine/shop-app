import { SERVER_DEVICE_ID } from '@repo/utilities/constants';
import Audit from '../audit/audit_service.js';
import Report from './report_model.js';

async function list(): Promise<EmailReportDoc[]> {
  return Report.find();
}

async function create(data: EmailReportDoc, device = SERVER_DEVICE_ID): Promise<EmailReportDoc> {
  const doc = new Report(data);
  await doc.save();
  await Audit.addReportAudit(null, doc, device);
  return doc;
}

async function update(
  doc: EmailReportDoc,
  device = SERVER_DEVICE_ID,
): Promise<EmailReportDoc | null> {
  const oldDoc = await Report.findById(doc._id);
  if (!oldDoc) throw new Error(`Missing report document id: ${doc._id}`);
  const updated = await Report.findByIdAndUpdate(doc._id, doc, { returnDocument: 'after' });
  if (!updated) throw new Error(`Unable to update report document id: ${doc._id}`);
  await Audit.addReportAudit(oldDoc, updated, device);
  return updated;
}

export default {
  list,
  create,
  update,
};

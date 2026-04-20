import type { HydratedDocument } from 'mongoose';
import Audit from '../audit/audit_service.js';
import Report from './report_model.js';

type EmailReportDoc = HydratedDocument<EmailReportFields>;

async function list(): Promise<EmailReportDoc[]> {
  return Report.find().sort({ email: 1 });
}

async function create(data: EmailReportCreate, deviceId: string): Promise<EmailReportDoc> {
  const doc = new Report(normalizeReport(data));
  await doc.save();
  await Audit.addReportAudit(null, doc, deviceId);
  return doc;
}

async function update(doc: EmailReportUpdate, deviceId: string): Promise<EmailReportDoc | null> {
  const oldDoc = await Report.findById(doc._id);
  if (!oldDoc) throw new Error(`Missing report document id: ${doc._id}`);
  const updated = await Report.findByIdAndUpdate(doc._id, normalizeReport(doc), {
    returnDocument: 'after',
  });
  if (!updated) throw new Error(`Unable to update report document id: ${doc._id}`);
  await Audit.addReportAudit(oldDoc, updated, deviceId);
  return updated;
}

async function remove(id: string, deviceId: string): Promise<boolean> {
  const oldDoc = await Report.findById(id);
  if (!oldDoc) return false;

  await Report.findByIdAndDelete(id);
  await Audit.addReportAudit(oldDoc, null, deviceId);
  return true;
}

function normalizeReport(data: EmailReportFields & Partial<EmailReportUpdate>) {
  return {
    ...data,
    email: String(data.email ?? '')
      .trim()
      .toLowerCase(),
    tooling: {
      to: Boolean(data.tooling?.to),
      cc: Boolean(data.tooling?.cc),
    },
  };
}

export default {
  list,
  create,
  update,
  remove,
};

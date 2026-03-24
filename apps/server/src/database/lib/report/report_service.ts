import Report from './report_model.js';

async function list(): Promise<EmailReportDoc[]> {
  return Report.find();
}

async function create(data: EmailReportDoc): Promise<EmailReportDoc> {
  const doc = new Report(data);
  await doc.save();
  return doc;
}

async function update(doc: EmailReportDoc): Promise<void> {
  await Report.findByIdAndUpdate(doc._id, doc);
}

export default {
  list,
  create,
  update,
};

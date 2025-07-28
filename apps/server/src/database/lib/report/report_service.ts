import Report from './report_model.js';

async function list(): Promise<ReportDoc[]> {
  return Report.find();
}

async function create(data: ReportDoc): Promise<ReportDoc> {
  const doc = new Report(data);
  await doc.save();
  return doc;
}

async function update(doc: ReportDoc): Promise<void> {
  await Report.findByIdAndUpdate(doc._id, doc);
}

export default {
  list,
  create,
  update,
};

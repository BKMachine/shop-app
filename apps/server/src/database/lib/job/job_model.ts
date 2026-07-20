import { type HydratedDocument, model, Schema, type Types } from 'mongoose';

type JobProductionTaskDocumentFields = Omit<JobProductionTask, 'startedAt' | 'endedAt'> & {
  startedAt: Date;
  endedAt?: Date | null;
};

type JobDocumentFields = Omit<Job, '_id' | 'customer' | 'part'> & {
  customer: Types.ObjectId;
  part: Types.ObjectId;
  dueDate?: Date | null;
  startedOn?: Date | null;
  completedOn?: Date | null;
  materialOrderedOn?: Date | null;
  materialOnHandOn?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const productionTaskSchema = new Schema<JobProductionTaskDocumentFields>(
  {
    id: { type: String, required: true },
    machineId: { type: String, required: true },
    machineName: { type: String, required: true },
    machineType: { type: String, enum: ['lathe', 'mill', 'swiss'], required: true },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, default: null },
  },
  {
    _id: false,
  },
);

const schema = new Schema<JobDocumentFields>(
  {
    jobNumber: { type: Number, required: true, unique: true, immutable: true, index: true },
    customer: { type: Schema.Types.ObjectId, ref: 'customers', required: true, index: true },
    part: { type: Schema.Types.ObjectId, ref: 'parts', required: true, index: true },
    qty: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ['open', 'in_process', 'closed'], default: 'open', index: true },
    dueDate: { type: Date, default: null, index: true },
    startedOn: { type: Date, default: null },
    completedOn: { type: Date, default: null },
    materialOrderedOn: { type: Date, default: null },
    materialOnHandOn: { type: Date, default: null },
    customerPo: { type: String, default: '', index: true },
    priority: { type: String, enum: ['low', 'normal', 'rush'], default: 'normal', index: true },
    notes: { type: String, default: '' },
    customerName: { type: String, default: '' },
    partNumber: { type: String, default: '', index: true },
    partDescription: { type: String, default: '' },
    partRevision: { type: String, default: '' },
    productionTasks: { type: [productionTaskSchema], default: [] },
  },
  {
    timestamps: true,
  },
);

schema.index({
  jobNumber: 'text',
  customerPo: 'text',
  customerName: 'text',
  partNumber: 'text',
  partDescription: 'text',
  partRevision: 'text',
  notes: 'text',
});

export default model<JobDocumentFields>('jobs', schema);
export type JobDoc = HydratedDocument<JobDocumentFields>;

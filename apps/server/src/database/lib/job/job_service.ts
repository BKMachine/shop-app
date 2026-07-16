import { isValidObjectId } from 'mongoose';
import { emit } from '../../../server/sockets.js';
import { getEntityIdOrNull } from '../../../utilities/entities.js';
import escapeRegExp from '../../../utilities/escapeRegExp.js';
import AuditService from '../audit/audit_service.js';
import Customer from '../customer/customer_model.js';
import Part from '../part/part_model.js';
import SequenceService from '../sequence/sequence_service.js';
import Job, { type JobDoc } from './job_model.js';

export class JobValidationError extends Error {}

export class JobNotFoundError extends Error {}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeQty(value: unknown): number {
  return Math.max(0, Number(value) || 0);
}

function normalizePriority(value: unknown): JobPriority {
  return value === 'low' || value === 'rush' ? value : 'normal';
}

function normalizeStatus(value: unknown): JobStatus {
  if (value === 'closed') return 'closed';
  if (value === 'in_process') return 'in_process';
  return 'open';
}

function currentDateOnlyValue() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0));
}

async function buildPayload(
  data: JobCreate | JobUpdate,
  jobNumber: number,
): Promise<Omit<Job, '_id' | 'createdAt' | 'updatedAt'>> {
  const customerId = getEntityIdOrNull(data.customer);
  const partId = getEntityIdOrNull(data.part);

  if (!customerId || !isValidObjectId(customerId)) {
    throw new JobValidationError('Invalid customer id provided for job.');
  }
  if (!partId || !isValidObjectId(partId)) {
    throw new JobValidationError('Invalid part id provided for job.');
  }

  const [customer, part] = await Promise.all([
    Customer.findById(customerId),
    Part.findById(partId, { customer: 1, part: 1, description: 1, revision: 1 }),
  ]);

  if (!customer) throw new JobValidationError(`Missing customer document id: ${customerId}`);
  if (!part) throw new JobValidationError(`Missing part document id: ${partId}`);

  const partCustomerId = getEntityIdOrNull(part.customer);
  if (!partCustomerId || partCustomerId !== customerId) {
    throw new JobValidationError('Selected part does not belong to the selected customer.');
  }

  const qty = normalizeQty(data.qty);
  if (qty < 1) throw new JobValidationError('Job quantity must be at least 1.');

  const status = normalizeStatus(data.status);
  const startedOn =
    status === 'in_process'
      ? (normalizeDate(data.startedOn) ?? currentDateOnlyValue())
      : normalizeDate(data.startedOn);
  const completedOn = status === 'closed' ? (normalizeDate(data.completedOn) ?? new Date()) : null;

  return {
    jobNumber,
    customer: customerId,
    part: partId,
    qty,
    status,
    dueDate: normalizeDate(data.dueDate),
    startedOn,
    completedOn,
    customerPo: normalizeText(data.customerPo),
    priority: normalizePriority(data.priority),
    notes: normalizeText(data.notes),
    customerName: customer.name,
    partNumber: part.part ?? '',
    partDescription: part.description ?? '',
    partRevision: normalizeText(part.revision),
  };
}

function buildListFilter(query: JobListQuery): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (query.customer && isValidObjectId(query.customer)) filter.customer = query.customer;
  if (query.part && isValidObjectId(query.part)) filter.part = query.part;
  if (query.status === 'not_closed') {
    filter.status = { $ne: 'closed' };
  }
  if (query.status === 'open' || query.status === 'in_process' || query.status === 'closed') {
    filter.status = query.status;
  }

  const dueDate: Record<string, Date> = {};
  const dueAfter = normalizeDate(query.dueAfter);
  const dueBefore = normalizeDate(query.dueBefore);
  if (dueAfter) dueDate.$gte = dueAfter;
  if (dueBefore) dueDate.$lte = dueBefore;
  if (Object.keys(dueDate).length) filter.dueDate = dueDate;

  const search = normalizeText(query.search);
  if (search) {
    const regex = { $regex: escapeRegExp(search), $options: 'i' };
    const numericJobNumber = /^\d+$/.test(search) ? Number(search) : null;

    filter.$or = [
      { customerPo: regex },
      { customerName: regex },
      { partNumber: regex },
      { partDescription: regex },
      { partRevision: regex },
      { notes: regex },
      ...(numericJobNumber ? [{ jobNumber: numericJobNumber }] : []),
    ];
  }

  return filter;
}

async function list(query: JobListQuery = {}): Promise<JobListResponse> {
  const filter = buildListFilter(query);
  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200);
  const offset = Math.max(Number(query.offset) || 0, 0);

  const [items, total] = await Promise.all([
    Job.find(filter)
      .populate('customer')
      .populate('part')
      .sort({ status: -1, dueDate: 1, jobNumber: -1, createdAt: -1 })
      .skip(offset)
      .limit(limit),
    Job.countDocuments(filter),
  ]);

  return {
    items: items as unknown as Job[],
    total,
    limit,
    offset,
    hasMore: offset + items.length < total,
  };
}

async function findById(id: string): Promise<JobDoc | null> {
  return Job.findById(id).populate('customer').populate('part');
}

async function create(data: JobCreate, deviceId: string): Promise<JobDoc> {
  const jobNumber = await SequenceService.nextValue('jobs');
  const job = new Job(await buildPayload(data, jobNumber));
  await job.save();

  const createdJob = await findById(job._id.toString());
  if (!createdJob) throw new Error(`Unable to load created job document id: ${job._id}`);

  await AuditService.addJobAudit(null, createdJob, deviceId);
  emit('job', createdJob);
  return createdJob;
}

async function update(data: JobUpdate, deviceId: string): Promise<JobDoc> {
  const oldJob = await findById(data._id);
  if (!oldJob) throw new JobNotFoundError(`Missing job document id: ${data._id}`);

  const payload = await buildPayload(data, oldJob.jobNumber);
  const updatedJob = await Job.findByIdAndUpdate(data._id, payload, {
    returnDocument: 'after',
  })
    .populate('customer')
    .populate('part');

  if (!updatedJob) throw new Error(`Unable to update job document id: ${data._id}`);

  await AuditService.addJobAudit(oldJob, updatedJob, deviceId);
  emit('job', updatedJob);
  return updatedJob;
}

async function remove(id: string, deviceId: string): Promise<boolean> {
  const oldJob = await findById(id);
  const result = await Job.findByIdAndDelete(id);
  if (!result) return false;

  await AuditService.addJobAudit(oldJob, null, deviceId);
  emit('jobDeleted', { id });
  return true;
}

export default {
  list,
  findById,
  create,
  update,
  remove,
};

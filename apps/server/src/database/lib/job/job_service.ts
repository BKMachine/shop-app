import { hasIncompleteMachineDashboardPartData } from '@repo/utilities/parts';
import { isValidObjectId } from 'mongoose';
import { emit } from '../../../server/sockets.js';
import { getEntityIdOrNull } from '../../../utilities/entities.js';
import escapeRegExp from '../../../utilities/escapeRegExp.js';
import AuditService from '../audit/audit_service.js';
import Customer from '../customer/customer_model.js';
import Machine from '../machine/index.js';
import type { MachineDoc } from '../machine/machine_model.js';
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

function normalizeActualProductionQty(value: unknown): number | null {
  if (value == null || value === '') return null;

  const qty = Number(value);
  if (!Number.isInteger(qty) || qty < 0) {
    throw new JobValidationError(
      'Actual production quantity must be a whole number of at least 0.',
    );
  }

  return qty;
}

function normalizePriority(value: unknown): JobPriority {
  return value === 'low' || value === 'rush' ? value : 'normal';
}

function normalizeStatus(value: unknown): JobStatus {
  if (value === 'closed') return 'closed';
  if (value === 'machining_complete') return 'machining_complete';
  if (value === 'in_process') return 'in_process';
  return 'open';
}

function normalizeProductionTasks(
  tasks: JobProductionTask[] | undefined,
  fallbackTasks: JobProductionTask[] = [],
): JobProductionTask[] {
  const sourceTasks = Array.isArray(tasks) ? tasks : fallbackTasks;

  return sourceTasks.map((task) => {
    const id = normalizeText(task.id);
    const machineId = normalizeText(task.machineId);
    const machineName = normalizeText(task.machineName);
    const startedAt = normalizeDate(task.startedAt);

    if (!id) {
      throw new JobValidationError('Production task id is required.');
    }
    if (!machineId) {
      throw new JobValidationError(`Production task ${id} is missing a machine id.`);
    }
    if (!machineName) {
      throw new JobValidationError(`Production task ${id} is missing a machine name.`);
    }
    if (!startedAt) {
      throw new JobValidationError(`Production task ${id} is missing a valid start timestamp.`);
    }

    return {
      id,
      machineId,
      machineName,
      machineType: task.machineType,
      startedAt,
      endedAt: normalizeDate(task.endedAt),
    };
  });
}

function normalizeShipmentSchedule(
  schedule: JobShipmentScheduleEntry[] | undefined,
  totalQty: number,
): JobShipmentScheduleEntry[] {
  if (!Array.isArray(schedule) || !schedule.length) return [];

  let allocatedQty = 0;

  return schedule.map((entry, index) => {
    const shipDate = normalizeDate(entry.shipDate);
    if (!shipDate) {
      throw new JobValidationError(`Shipment schedule entry ${index + 1} is missing a valid date.`);
    }

    const isLastEntry = index === schedule.length - 1;
    if (isLastEntry) {
      const remainingQty = totalQty - allocatedQty;
      if (remainingQty < 1) {
        throw new JobValidationError('Shipment schedule quantities exceed the job quantity.');
      }

      return {
        shipDate,
        qty: remainingQty,
        po: normalizeText(entry.po),
      };
    }

    const qty = Math.trunc(Number(entry.qty) || 0);
    if (qty < 1) {
      throw new JobValidationError(
        `Shipment schedule entry ${index + 1} must have a quantity of at least 1.`,
      );
    }

    allocatedQty += qty;
    if (allocatedQty >= totalQty) {
      throw new JobValidationError(
        'Shipment schedule quantities before the final shipment must leave a remainder.',
      );
    }

    return {
      shipDate,
      qty,
      po: normalizeText(entry.po),
    };
  });
}

function normalizeShipmentRecords(
  records: JobShipmentRecord[] | undefined,
  totalQty: number,
  fallbackRecords: JobShipmentRecord[] = [],
): JobShipmentRecord[] {
  const sourceRecords = Array.isArray(records) ? records : fallbackRecords;
  let totalShippedQty = 0;

  return sourceRecords.map((record, index) => {
    const id = normalizeText(record.id);
    const shippedAt = normalizeDate(record.shippedAt);
    const qty = Math.trunc(Number(record.qty) || 0);

    if (!id) {
      throw new JobValidationError(`Shipment record ${index + 1} is missing an id.`);
    }
    if (!shippedAt) {
      throw new JobValidationError(`Shipment record ${index + 1} is missing a valid date.`);
    }
    if (qty < 1) {
      throw new JobValidationError(
        `Shipment record ${index + 1} must have a quantity of at least 1.`,
      );
    }

    totalShippedQty += qty;
    if (totalShippedQty > totalQty) {
      throw new JobValidationError('Recorded shipments cannot exceed the job quantity.');
    }

    return {
      id,
      shippedAt,
      qty,
      po: normalizeText(record.po),
    };
  });
}

function hasOpenProductionTasks(tasks: JobProductionTask[]) {
  return tasks.some((task) => !task.endedAt);
}

function hasAddedProductionTasks(
  tasks: JobProductionTask[],
  fallbackTasks: JobProductionTask[] = [],
) {
  const existingTaskIds = new Set(fallbackTasks.map((task) => task.id));
  return tasks.some((task) => !existingTaskIds.has(task.id));
}

function currentDateOnlyValue() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0));
}

async function buildPayload(
  data: JobCreate | JobUpdate,
  jobNumber: number,
  fallbackProductionTasks: JobProductionTask[] = [],
  fallbackShipmentRecords: JobShipmentRecord[] = [],
  previousStatus?: JobStatus,
  fallbackActualProductionQty?: number | null,
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
  const actualProductionQty =
    data.actualProductionQty === undefined
      ? (fallbackActualProductionQty ?? null)
      : normalizeActualProductionQty(data.actualProductionQty);
  const shipmentSchedule = normalizeShipmentSchedule(data.shipmentSchedule, qty);
  const shipmentRecords = normalizeShipmentRecords(
    data.shipmentRecords,
    qty,
    fallbackShipmentRecords,
  );

  const requestedStatus = normalizeStatus(data.status);
  const productionTasks = normalizeProductionTasks(data.productionTasks, fallbackProductionTasks);
  const addedProductionTasks = hasAddedProductionTasks(productionTasks, fallbackProductionTasks);

  if (previousStatus === 'closed' && addedProductionTasks) {
    throw new JobValidationError('Cannot add production tasks to a closed job.');
  }

  if (requestedStatus === 'closed' && hasOpenProductionTasks(productionTasks)) {
    throw new JobValidationError('All production tasks must be ended before closing the job.');
  }
  if (requestedStatus === 'machining_complete' && hasOpenProductionTasks(productionTasks)) {
    throw new JobValidationError(
      'All production tasks must be ended before marking the job as machining complete.',
    );
  }
  if (requestedStatus === 'machining_complete' && actualProductionQty === null) {
    throw new JobValidationError(
      'Actual production quantity is required before marking the job as machining complete.',
    );
  }

  const status =
    addedProductionTasks && requestedStatus !== 'closed' ? 'in_process' : requestedStatus;
  const startedOn =
    status === 'in_process'
      ? (normalizeDate(data.startedOn) ?? currentDateOnlyValue())
      : normalizeDate(data.startedOn);
  const completedOn = status === 'closed' ? (normalizeDate(data.completedOn) ?? new Date()) : null;
  const materialOrderedOn = normalizeDate(data.materialOrderedOn);
  const materialOnHandOn = normalizeDate(data.materialOnHandOn);

  return {
    jobNumber,
    customer: customerId,
    part: partId,
    qty,
    actualProductionQty,
    status,
    dueDate: shipmentSchedule[0]?.shipDate ?? normalizeDate(data.dueDate),
    startedOn,
    completedOn,
    materialOrderedOn,
    materialOnHandOn,
    customerPo: normalizeText(data.customerPo),
    priority: normalizePriority(data.priority),
    notes: normalizeText(data.notes),
    customerName: customer.name,
    partNumber: part.part ?? '',
    partDescription: part.description ?? '',
    partRevision: normalizeText(part.revision),
    shipmentSchedule,
    shipmentRecords,
    productionTasks,
  };
}

function buildListFilter(query: JobListQuery): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (Number.isInteger(query.jobNumber) && Number(query.jobNumber) > 0) {
    filter.jobNumber = Number(query.jobNumber);
  }
  if (query.customer && isValidObjectId(query.customer)) filter.customer = query.customer;
  if (query.part && isValidObjectId(query.part)) filter.part = query.part;
  if (query.status === 'not_closed') {
    filter.status = { $ne: 'closed' };
  }
  if (
    query.status === 'open' ||
    query.status === 'in_process' ||
    query.status === 'machining_complete' ||
    query.status === 'closed'
  ) {
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

const validSortFields = new Set([
  'jobNumber',
  'partNumber',
  'customerName',
  'qty',
  'status',
  'priority',
  'dueDate',
  'completedOn',
  'customerPo',
]);

function getSortField(query: JobListQuery): string {
  return query.sort && validSortFields.has(query.sort) ? query.sort : 'jobNumber';
}

function getSortDirection(query: JobListQuery): 1 | -1 {
  return query.order === 'desc' ? -1 : 1;
}

function normalizeTaskTimestamp(value: string | Date | null | undefined) {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? 0 : time;
}

function toMachineDashboardPartSummary(
  partNumber?: string | null,
  partDescription?: string | null,
) {
  const normalizedPartNumber = normalizeText(partNumber);
  const normalizedPartDescription = normalizeText(partDescription);

  if (normalizedPartNumber && normalizedPartDescription) {
    return `${normalizedPartNumber} / ${normalizedPartDescription}`;
  }

  return normalizedPartNumber || normalizedPartDescription;
}

function extractPartImage(value: unknown) {
  if (!value || typeof value !== 'object' || !('img' in value)) return null;

  const imageValue = value.img;
  return typeof imageValue === 'string' && imageValue.trim() ? imageValue.trim() : null;
}

function extractReferencedId(value: unknown) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value !== 'object' || !('_id' in value)) return null;

  const idValue = value._id;
  if (typeof idValue === 'string' && idValue.trim()) return idValue;
  if (idValue && typeof idValue === 'object' && 'toString' in idValue) {
    const normalizedId = idValue.toString();
    return normalizedId.trim() ? normalizedId : null;
  }

  return null;
}

function extractPartCostData(
  value: unknown,
): Parameters<typeof hasIncompleteMachineDashboardPartData>[0] {
  if (!value || typeof value !== 'object') return null;

  if (
    'price' in value ||
    'derived' in value ||
    'subComponentIds' in value ||
    'cycleTimes' in value ||
    'additionalCosts' in value ||
    'customerSuppliedMaterial' in value ||
    'material' in value
  ) {
    return value as Parameters<typeof hasIncompleteMachineDashboardPartData>[0];
  }

  return null;
}

function extractPartText(value: unknown, field: 'part' | 'description') {
  if (!value || typeof value !== 'object' || !(field in value)) return null;

  const fieldValue = (value as Record<string, unknown>)[field];
  return typeof fieldValue === 'string' && fieldValue.trim() ? fieldValue.trim() : null;
}

function getMachineDashboardPartHasIncompleteData(value: unknown) {
  return hasIncompleteMachineDashboardPartData(extractPartCostData(value));
}

function getMachineDepartmentName(value: MachineDoc['department']): string {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if ('name' in value && typeof value.name === 'string') return value.name.trim();
  return '';
}

async function listMachineDashboard(): Promise<MachineJobDashboardResponse> {
  const [machines, jobs] = await Promise.all([
    Machine.find().populate('department').sort({ name: 1 }),
    Job.find({ status: 'in_process' })
      .populate('part', {
        part: 1,
        description: 1,
        img: 1,
        price: 1,
        cycleTimes: 1,
        additionalCosts: 1,
        material: 1,
        customerSuppliedMaterial: 1,
        subComponentIds: 1,
        hasSubComponents: 1,
        'derived.directParentCount': 1,
        'derived.hasIncompleteSubComponentCosts': 1,
      })
      .sort({ dueDate: 1, jobNumber: -1 }),
  ]);

  const activeJobsByMachineId = new Map<
    string,
    Array<{
      task: JobProductionTask;
      job: Pick<
        Job,
        '_id' | 'jobNumber' | 'qty' | 'dueDate' | 'partNumber' | 'partDescription' | 'priority'
      > & {
        partId: string | null;
        partImage: string | null;
        partHasIncompleteData: boolean;
      };
    }>
  >();

  for (const job of jobs) {
    const openTasks = (job.productionTasks ?? []).filter((task) => !task.endedAt);
    for (const task of openTasks) {
      const existingEntries = activeJobsByMachineId.get(task.machineId) ?? [];
      existingEntries.push({
        task,
        job: {
          _id: job._id.toString(),
          jobNumber: job.jobNumber,
          qty: job.qty,
          dueDate: job.dueDate,
          priority: job.priority,
          partId: extractReferencedId(job.part),
          partNumber: extractPartText(job.part, 'part') ?? job.partNumber,
          partDescription: extractPartText(job.part, 'description') ?? job.partDescription,
          partImage: extractPartImage(job.part),
          partHasIncompleteData: getMachineDashboardPartHasIncompleteData(job.part),
        },
      });
      activeJobsByMachineId.set(task.machineId, existingEntries);
    }
  }

  const active: MachineJobDashboardRow[] = [];
  const idle: MachineJobDashboardRow[] = [];

  for (const machine of machines) {
    const machineId = machine._id.toString();
    const machineName = machine.displayName?.trim() || machine.name;
    const activeEntries = activeJobsByMachineId.get(machineId) ?? [];

    if (activeEntries.length) {
      const sortedEntries = [...activeEntries].sort(
        (left, right) =>
          normalizeTaskTimestamp(right.task.startedAt) -
          normalizeTaskTimestamp(left.task.startedAt),
      );

      for (const activeEntry of sortedEntries) {
        active.push({
          machineId,
          machineName,
          machineType: machine.type,
          department: getMachineDepartmentName(machine.department),
          location: machine.location,
          hasInProcessJob: true,
          priority: activeEntry.job.priority ?? 'normal',
          taskId: activeEntry.task.id,
          taskStartedAt: activeEntry.task.startedAt,
          jobId: activeEntry.job._id,
          jobNumber: activeEntry.job.jobNumber,
          qty: activeEntry.job.qty,
          dueDate: activeEntry.job.dueDate ?? null,
          partId: activeEntry.job.partId ?? null,
          partNumber: activeEntry.job.partNumber ?? null,
          partDescription: activeEntry.job.partDescription ?? null,
          partImage: activeEntry.job.partImage ?? null,
          partHasIncompleteData: activeEntry.job.partHasIncompleteData,
          partSummary: toMachineDashboardPartSummary(
            activeEntry.job.partNumber,
            activeEntry.job.partDescription,
          ),
        });
      }
    } else {
      idle.push({
        machineId,
        machineName,
        machineType: machine.type,
        department: getMachineDepartmentName(machine.department),
        location: machine.location,
        hasInProcessJob: false,
        priority: null,
        jobId: null,
        jobNumber: null,
        qty: null,
        dueDate: null,
        partId: null,
        partNumber: null,
        partDescription: null,
        partImage: null,
        partHasIncompleteData: false,
        partSummary: '',
      });
    }
  }

  return { active, idle };
}

async function list(query: JobListQuery = {}): Promise<JobListResponse> {
  const filter = buildListFilter(query);
  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200);
  const offset = Math.max(Number(query.offset) || 0, 0);
  const sortField = getSortField(query);
  const sortDirection = getSortDirection(query);

  const [items, total, matchingJobs] = await Promise.all([
    Job.find(filter)
      .populate('customer')
      .populate('part')
      .sort({ [sortField]: sortDirection, createdAt: -1 })
      .skip(offset)
      .limit(limit),
    Job.countDocuments(filter),
    Job.find(filter).populate('part'),
  ]);

  const totalValue = matchingJobs.reduce((sum, job) => {
    const populatedPart =
      job.part && typeof job.part === 'object' ? (job.part as { price?: number }) : null;
    const partPrice = Number(populatedPart?.price) || 0;
    const qty = Number(job.qty) || 0;
    return sum + qty * partPrice;
  }, 0);

  return {
    items: items as unknown as Job[],
    total,
    totalValue,
    limit,
    offset,
    hasMore: offset + items.length < total,
  };
}

async function listHistoryByPart(
  partId: string,
  query: Pick<JobListQuery, 'sort' | 'order' | 'limit' | 'offset'> = {},
): Promise<JobHistoryListResponse> {
  const filter = { part: partId };
  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200);
  const offset = Math.max(Number(query.offset) || 0, 0);
  const sortField = getSortField(query as JobListQuery);
  const sortDirection = getSortDirection(query as JobListQuery);

  const [items, total] = await Promise.all([
    Job.find(filter)
      .populate('customer')
      .populate('part')
      .sort({ [sortField]: sortDirection, createdAt: -1 })
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

  const payload = await buildPayload(
    data,
    oldJob.jobNumber,
    oldJob.productionTasks ?? [],
    oldJob.shipmentRecords ?? [],
    oldJob.status,
    oldJob.actualProductionQty,
  );
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
  listHistoryByPart,
  listMachineDashboard,
  findById,
  create,
  update,
  remove,
};

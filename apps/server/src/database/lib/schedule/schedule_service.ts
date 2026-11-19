import { addDays, DEFAULT_SCHEDULE_SETTINGS, scheduleEnd } from '@repo/utilities/schedule';
import { DEFAULT_BUSINESS_TIME_ZONE } from '@repo/utilities/time';
import type { Types } from 'mongoose';
import logger from '../../../logger.js';
import { emit } from '../../../server/sockets.js';
import AuditService from '../audit/audit_service.js';
import DepartmentService from '../department/department_service.js';
import Job from '../job/job_model.js';
import Machine from '../machine/machine_model.js';
import { createScheduleAuditQueue, type QueuedScheduleChange } from './schedule_audit_queue.js';
import ScheduleEntryModel from './schedule_model.js';
import ScheduleSettingsModel, { SCHEDULE_SETTINGS_ID } from './schedule_settings_model.js';

export class ScheduleNotFoundError extends Error {}

type PopulatedJob = {
  _id: Types.ObjectId;
  jobNumber: number;
  customer: Types.ObjectId;
  customerName?: string;
  partNumber?: string;
  partDescription?: string;
  part?: { img?: string } | null;
  qty: number;
  dueDate?: Date | null;
  status: JobStatus;
  priority?: JobPriority;
};

type LeanEntry = {
  _id: Types.ObjectId;
  job: PopulatedJob | null;
  routingId?: string | null;
  op?: number | null;
  operation?: string | null;
  department?: string | null;
  machineId: string;
  start: string;
  days: number;
};

/** What the audit trail keeps for a booking: readable names rather than ids alone. */
type ScheduleAuditRecord = {
  _id: string;
  description: string;
  job: string;
  jobNumber: number | null;
  routingId: string | null;
  op: number | null;
  operation: string | null;
  machineId: string;
  machine: string;
  start: string;
  lastDay: string;
  days: number;
};

const JOB_FIELDS =
  'jobNumber customer customerName part partNumber partDescription qty dueDate status priority';

/** The booked job, with its part's image, as a booking is sent to the app. */
const JOB_POPULATE = { path: 'job', select: JOB_FIELDS, populate: { path: 'part', select: 'img' } };

function toEntry(doc: LeanEntry): ScheduleEntry | null {
  const { job } = doc;
  if (!job) return null;

  return {
    _id: doc._id.toString(),
    routingId: doc.routingId ?? null,
    op: doc.op ?? null,
    operation: doc.operation ?? null,
    department: doc.department ?? null,
    machineId: doc.machineId,
    start: doc.start,
    days: doc.days,
    job: {
      _id: job._id.toString(),
      jobNumber: job.jobNumber,
      customerId: job.customer.toString(),
      customerName: job.customerName ?? '',
      partNumber: job.partNumber ?? '',
      partDescription: job.partDescription ?? '',
      partImg: job.part?.img?.trim() ?? '',
      qty: job.qty,
      // Due dates are saved at noon UTC, so the UTC date is the day that was picked.
      dueDate: job.dueDate ? job.dueDate.toISOString().slice(0, 10) : null,
      status: job.status,
      priority: job.priority ?? 'normal',
    },
  };
}

/** Entries that run on or after `from`, and start before `to` when given. */
async function list(range: { from: string; to?: string }): Promise<ScheduleEntry[]> {
  const filter: Record<string, unknown> = { end: { $gt: range.from } };
  if (range.to) filter.start = { $lt: range.to };

  const docs = await ScheduleEntryModel.find(filter)
    .sort({ machineId: 1, start: 1 })
    .populate(JOB_POPULATE)
    .lean<LeanEntry[]>();

  return docs.map(toEntry).filter((entry): entry is ScheduleEntry => entry !== null);
}

async function findMany(ids: string[]): Promise<LeanEntry[]> {
  if (!ids.length) return [];
  return ScheduleEntryModel.find({ _id: { $in: ids } })
    .populate('job', 'jobNumber')
    .lean<LeanEntry[]>();
}

async function machineNames(): Promise<Map<string, string>> {
  const machines = await Machine.find({}, { name: 1, displayName: 1 }).lean();
  return new Map(
    machines.map((machine) => [machine._id.toString(), machine.displayName || machine.name]),
  );
}

function toAuditRecord(entry: LeanEntry, names: Map<string, string>): ScheduleAuditRecord {
  const machine = names.get(entry.machineId) ?? entry.machineId;
  const jobNumber = entry.job?.jobNumber ?? null;
  const op = entry.op ?? null;
  return {
    _id: entry._id.toString(),
    description: `Job #${jobNumber ?? '?'}${op ? ` op ${op}` : ''} on ${machine}`,
    job: entry.job?._id.toString() ?? '',
    jobNumber,
    routingId: entry.routingId ?? null,
    op,
    operation: entry.operation ?? null,
    machineId: entry.machineId,
    machine,
    start: entry.start,
    lastDay: addDays(entry.start, entry.days - 1),
    days: entry.days,
  };
}

/** How long a job's bookings go untouched before their changes are audited. */
export const SCHEDULE_AUDIT_QUIET_MS = 2 * 60_000;

function sameBooking(before: LeanEntry, after: LeanEntry) {
  return (
    before.machineId === after.machineId &&
    before.start === after.start &&
    before.days === after.days
  );
}

async function writeAudits(changes: QueuedScheduleChange<LeanEntry>[]): Promise<void> {
  const names = await machineNames();
  for (const change of changes) {
    await AuditService.addAudit(
      'schedule',
      change.before ? toAuditRecord(change.before, names) : null,
      change.after ? toAuditRecord(change.after, names) : null,
      change.deviceId,
      change.timestamp,
    );
  }
}

/**
 * Rearranging the schedule moves bookings many times over, so each job's changes are held until
 * its bookings sit untouched for {@link SCHEDULE_AUDIT_QUIET_MS}, then audited once, from where
 * each booking started to where it ended up.
 */
const auditQueue = createScheduleAuditQueue<LeanEntry>({
  quietMs: SCHEDULE_AUDIT_QUIET_MS,
  idOf: (entry) => entry._id.toString(),
  groupOf: (entry) => entry.job?._id.toString() ?? entry._id.toString(),
  same: sameBooking,
  write: writeAudits,
  onError: (error) => logger.error('Failed to write schedule audits:', error),
});

/** Queues an audit for each booking that changed between the two snapshots, by id. */
function auditChanges(before: LeanEntry[], after: LeanEntry[], deviceId: string): void {
  auditQueue.queue(before, after, deviceId);
}

/** Writes the schedule audits still waiting out their quiet time; called on shutdown. */
async function flushAudits(): Promise<number> {
  const pending = auditQueue.size();
  await auditQueue.flush();
  return pending;
}

/** Books a job and applies any placements the booking pushed along with it. */
async function create(
  data: ScheduleEntryCreate,
  pushed: ScheduleEntryPlacement[],
  deviceId: string,
): Promise<ScheduleEntry> {
  const jobExists = await Job.exists({ _id: data.job });
  if (!jobExists) throw new ScheduleNotFoundError(`Missing job document id: ${data.job}`);

  const pushedIds = pushed.map((placement) => placement._id);
  const before = await findMany(pushedIds);
  const created = await ScheduleEntryModel.create({ ...data, end: scheduleEnd(data) });
  if (pushed.length) await writePlacements(pushed);

  const after = await findMany([created._id.toString(), ...pushedIds]);
  auditChanges(before, after, deviceId);

  const populated = await ScheduleEntryModel.findById(created._id)
    .populate(JOB_POPULATE)
    .lean<LeanEntry>();
  const entry = populated ? toEntry(populated) : null;
  if (!entry) throw new Error(`Unable to read back schedule entry id: ${created._id}`);
  emit('schedule');
  return entry;
}

async function place(placements: ScheduleEntryPlacement[], deviceId: string): Promise<void> {
  const ids = placements.map((placement) => placement._id);
  const before = await findMany(ids);
  const matched = await writePlacements(placements);
  const after = await findMany(ids);
  auditChanges(before, after, deviceId);
  emit('schedule');

  if (matched !== placements.length) {
    throw new ScheduleNotFoundError('One or more schedule entries no longer exist.');
  }
}

async function writePlacements(placements: ScheduleEntryPlacement[]): Promise<number> {
  const result = await ScheduleEntryModel.bulkWrite(
    placements.map((placement) => ({
      updateOne: {
        filter: { _id: placement._id },
        update: {
          $set: {
            machineId: placement.machineId,
            start: placement.start,
            days: placement.days,
            end: scheduleEnd(placement),
          },
        },
      },
    })),
  );
  return result.matchedCount;
}

async function remove(id: string, deviceId: string): Promise<boolean> {
  const [existing] = await findMany([id]);
  if (!existing) return false;
  await ScheduleEntryModel.deleteOne({ _id: id });
  auditChanges([existing], [], deviceId);
  emit('schedule');
  return true;
}

/** Drops every booking for a job, used when the job itself is deleted. */
async function removeByJob(jobId: string, deviceId: string): Promise<void> {
  const existing = await ScheduleEntryModel.find({ job: jobId })
    .populate('job', 'jobNumber')
    .lean<LeanEntry[]>();
  if (!existing.length) return;
  await ScheduleEntryModel.deleteMany({ job: jobId });
  auditChanges(existing, [], deviceId);
  emit('schedule');
}

/** Today's calendar day in the shop's time zone, as a schedule day key. */
function shopToday(): string {
  // en-CA formats a date as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: DEFAULT_BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** The job booked on each machine today, by machine id. Bookings never overlap on a machine. */
async function bookedToday(): Promise<Map<string, { jobId: string; jobNumber: number | null }>> {
  const today = shopToday();
  const entries = await ScheduleEntryModel.find({ start: { $lte: today }, end: { $gt: today } })
    .populate('job', 'jobNumber')
    .lean<LeanEntry[]>();

  return new Map(
    entries
      .filter((entry) => entry.job)
      .map((entry) => [
        entry.machineId,
        { jobId: entry.job?._id.toString() ?? '', jobNumber: entry.job?.jobNumber ?? null },
      ]),
  );
}

/* ---------- Settings ---------- */

function normalizeSettings(data: Partial<ScheduleSettings> | null | undefined): ScheduleSettings {
  const defaults = DEFAULT_SCHEDULE_SETTINGS;
  const utilization = data?.departmentUtilization ?? {};
  const entries =
    utilization instanceof Map ? [...utilization.entries()] : Object.entries(utilization);
  return {
    workdayStartHour: data?.workdayStartHour ?? defaults.workdayStartHour,
    workdayEndHour: data?.workdayEndHour ?? defaults.workdayEndHour,
    workdays: [...(data?.workdays ?? defaults.workdays)].sort((left, right) => left - right),
    defaultUtilization: data?.defaultUtilization ?? defaults.defaultUtilization,
    departmentUtilization: Object.fromEntries(entries),
  };
}

async function getSettings(): Promise<ScheduleSettings> {
  const doc = await ScheduleSettingsModel.findById(SCHEDULE_SETTINGS_ID).lean();
  return normalizeSettings(doc);
}

/** Settings as the audit trail shows them, with department names in place of ids. */
async function toSettingsAuditRecord(settings: ScheduleSettings) {
  const names = await DepartmentService.getNameById();
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return {
    _id: SCHEDULE_SETTINGS_ID,
    description: 'Schedule settings',
    workday: `${settings.workdayStartHour}:00–${settings.workdayEndHour}:00`,
    workdays: settings.workdays.map((day) => weekdays[day]).join(', '),
    defaultUtilization: settings.defaultUtilization,
    departmentUtilization: Object.fromEntries(
      Object.entries(settings.departmentUtilization).map(([id, value]) => [
        names.get(id) ?? id,
        value,
      ]),
    ),
  };
}

async function updateSettings(data: ScheduleSettings, deviceId: string): Promise<ScheduleSettings> {
  const before = await getSettings();
  const next = normalizeSettings(data);
  await ScheduleSettingsModel.replaceOne(
    { _id: SCHEDULE_SETTINGS_ID },
    { ...next, _id: SCHEDULE_SETTINGS_ID },
    { upsert: true },
  );

  await AuditService.addAudit(
    'schedule',
    await toSettingsAuditRecord(before),
    await toSettingsAuditRecord(next),
    deviceId,
  );
  emit('scheduleSettings', next);
  return next;
}

/**
 * Points op bookings at their routing op's id, by the op number they were booked with, for
 * bookings made before bookings kept the id. Also re-links a booking whose op id is no longer on
 * the part (a save from an older server drops op ids and the next start assigns new ones) when an
 * op with the same number and name is still there. Safe to run on every start. Returns how many
 * bookings changed.
 */
async function backfillRoutingIds(): Promise<number> {
  const entries = await ScheduleEntryModel.find(
    { op: { $ne: null } },
    { job: 1, op: 1, operation: 1, routingId: 1 },
  ).lean();
  if (!entries.length) return 0;

  const jobs = await Job.find(
    { _id: { $in: [...new Set(entries.map((entry) => entry.job.toString()))] } },
    { part: 1 },
  )
    .populate<{
      part: { routing?: Array<{ _id?: Types.ObjectId; op: number; operation?: string }> } | null;
    }>('part', 'routing')
    .lean();
  const routingByJob = new Map(jobs.map((job) => [job._id.toString(), job.part?.routing ?? []]));
  const sameName = (left?: string | null, right?: string | null) =>
    (left ?? '').trim().toLowerCase() === (right ?? '').trim().toLowerCase();

  const updates = entries.flatMap((entry) => {
    const routing = routingByJob.get(entry.job.toString());
    if (!routing) return [];
    if (
      entry.routingId &&
      routing.some((operation) => operation._id?.toString() === entry.routingId)
    ) {
      return [];
    }
    const operation = routing.find(
      (candidate) =>
        candidate.op === entry.op &&
        (!entry.routingId || sameName(candidate.operation, entry.operation)),
    );
    if (!operation?._id) return [];
    return [
      {
        updateOne: {
          filter: { _id: entry._id, routingId: entry.routingId ?? null },
          update: { $set: { routingId: operation._id.toString() } },
        },
      },
    ];
  });
  if (updates.length) await ScheduleEntryModel.bulkWrite(updates);
  return updates.length;
}

export default {
  backfillRoutingIds,
  flushAudits,
  list,
  create,
  place,
  remove,
  removeByJob,
  bookedToday,
  getSettings,
  updateSettings,
};

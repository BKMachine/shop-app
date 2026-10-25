import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod';
import Jobs from '../../database/lib/job/job_service.js';
import { getEntityIdOrNull } from '../../utilities/entities.js';
import mongoObjectId from '../../utilities/mongoObjectId.js';
import { findCustomerId, jsonResult, PageInput, pageResult, parseRange } from './utils.js';

const statusDescription =
  'open (not started), in_process (on a machine), machining_complete (waiting to ship), closed';

const FindJobsInput = z.object({
  search: z
    .string()
    .optional()
    .describe(
      'Case-insensitive text matched against the customer PO, customer name, part number, description, revision and notes; a number also matches the job number.',
    ),
  status: z
    .enum(['open', 'in_process', 'machining_complete', 'closed', 'not_closed'])
    .optional()
    .describe(`Job status: ${statusDescription}. not_closed is every status but closed.`),
  customer: z
    .string()
    .optional()
    .describe("Customer name, or enough of it to match only one customer's name."),
  partId: mongoObjectId.optional().describe('Only jobs for this part (id from find_parts).'),
  dueAfter: z.string().optional().describe('Due on or after this date, YYYY-MM-DD.'),
  dueBefore: z.string().optional().describe('Due on or before this date, YYYY-MM-DD.'),
  sort: z
    .enum([
      'jobNumber',
      'dueDate',
      'completedOn',
      'partNumber',
      'customerName',
      'qty',
      'status',
      'priority',
    ])
    .default('jobNumber'),
  order: z.enum(['asc', 'desc']).default('desc'),
  ...PageInput,
});

const GetJobInput = z
  .object({
    jobNumber: z.number().int().positive().optional(),
    jobId: mongoObjectId.optional(),
  })
  .refine((input) => (input.jobNumber === undefined) !== (input.jobId === undefined), {
    message: 'Provide exactly one of jobNumber or jobId.',
  });

// Job dates (due, started, shipped, ...) are calendar days, saved at or near midnight UTC, so
// they're compared and reported as UTC dates rather than times.
function toCalendarDate(value: string | Date | null | undefined): string | null {
  return value ? new Date(value).toISOString().slice(0, 10) : null;
}

function sumQty(entries: { qty: number }[] | undefined) {
  return (entries ?? []).reduce((total, entry) => total + (Number(entry.qty) || 0), 0);
}

function toJobSummary(job: Job) {
  return {
    id: job._id.toString(),
    jobNumber: job.jobNumber,
    status: job.status,
    priority: job.priority ?? 'normal',
    customer: job.customerName || null,
    partId: getEntityIdOrNull(job.part),
    partNumber: job.partNumber || null,
    partRevision: job.partRevision || null,
    partDescription: job.partDescription || null,
    qty: job.qty,
    actualProductionQty: job.actualProductionQty ?? null,
    shippedQty: sumQty(job.shipmentRecords),
    customerPo: job.customerPo || null,
    dueDate: toCalendarDate(job.dueDate),
    startedOn: toCalendarDate(job.startedOn),
    completedOn: toCalendarDate(job.completedOn),
    runningOn: (job.productionTasks ?? [])
      .filter((task) => !task.endedAt)
      .map((task) => task.machineName),
  };
}

export default function registerJobTools(server: McpServer): void {
  server.registerTool(
    'find_jobs',
    {
      title: 'Find jobs',
      description: `Search production jobs: a quantity of one part made for a customer order. Statuses are ${statusDescription}. Results are summaries; use get_job for shipments, machine time and notes. totalValue is quantity times part price over every matching job.`,
      inputSchema: FindJobsInput,
      annotations: { readOnlyHint: true },
    },
    async ({ customer, partId, dueAfter, dueBefore, ...filters }) => {
      const { fromDate, toDate } = parseRange(
        dueAfter,
        dueBefore,
        ['dueAfter', 'dueBefore'],
        'utc',
      );
      const page = await Jobs.list({
        ...filters,
        customer: customer ? await findCustomerId(customer) : undefined,
        part: partId,
        dueAfter: fromDate?.toISOString(),
        dueBefore: toDate?.toISOString(),
      });
      return pageResult('jobs', page, toJobSummary, { totalValue: page.totalValue });
    },
  );

  server.registerTool(
    'get_job',
    {
      title: 'Get job',
      description:
        "A job's full details: the summary fields plus notes, material ordered and on-hand dates, the shipment schedule, shipments made, and the machines it ran on with each run's start and end time. A task or run with no end is still running. Job dates are calendar dates (YYYY-MM-DD); machine run times are timestamps.",
      inputSchema: GetJobInput,
      annotations: { readOnlyHint: true },
    },
    async ({ jobNumber, jobId }) => {
      const job = jobId
        ? ((await Jobs.findById(jobId))?.toObject() as Job | undefined)
        : (await Jobs.list({ jobNumber, limit: 1 })).items[0];
      if (!job) throw new Error(`No job ${jobNumber ?? jobId}.`);

      return jsonResult({
        ...toJobSummary(job),
        notes: job.notes || null,
        materialOrderedOn: toCalendarDate(job.materialOrderedOn),
        materialOnHandOn: toCalendarDate(job.materialOnHandOn),
        shipmentSchedule: (job.shipmentSchedule ?? []).map(({ shipDate, qty, po }) => ({
          shipDate: toCalendarDate(shipDate),
          qty,
          po: po || null,
        })),
        shipments: (job.shipmentRecords ?? []).map(({ shippedAt, qty, po }) => ({
          shippedOn: toCalendarDate(shippedAt),
          qty,
          po: po || null,
        })),
        machineTime: (job.productionTasks ?? []).map((task) => ({
          machine: task.machineName,
          machineType: task.machineType,
          startedAt: task.startedAt,
          endedAt: task.endedAt ?? null,
          runs: (task.runs ?? []).map(({ startedAt, endedAt }) => ({
            startedAt,
            endedAt: endedAt ?? null,
          })),
        })),
        createdAt: job.createdAt,
      });
    },
  );
}

import { calculateTaskBusinessDurationMs } from '@repo/utilities/time';
import { CronJob } from 'cron';
import { DateTime } from 'luxon';
import nodemailer from 'nodemailer';
import JobModel from '../database/lib/job/job_model.js';
import Reports from '../database/lib/report/report_service.js';
import type { ToolPopulatedDoc } from '../database/lib/tool/tool_model.js';
import Tool from '../database/lib/tool/tool_service.js';
import logger from '../logger.js';

const REPORT_TIME_ZONE = 'America/Denver';
type ReorderTool = ToolPopulatedDoc & {
  vendor: Vendor;
  supplier: Supplier;
  item: string;
};

type JobReportPeriod = 'daily' | 'weekly';

type JobReportJob = Job & {
  customer?: Customer | string;
  part?: Part | string;
};

type JobReportTask = JobProductionTask & {
  job: JobReportJob;
  businessDurationMs: number;
};

function isReorderTool(tool: ToolPopulatedDoc): tool is ReorderTool {
  return Boolean(tool.vendor && tool.supplier && tool.item);
}

const transporter = nodemailer.createTransport({
  host: 'mail.bkmachine.net',
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

new CronJob(
  '0 0 8 * * 1', // At 08:00 AM, only on Monday
  () => {
    reorders().catch((e) => logger.error(e));
  },
  null,
  true,
  REPORT_TIME_ZONE,
);

new CronJob(
  '0 0 17 * * 1-5', // At 05:00 PM, Monday through Friday
  () => {
    jobReport('daily').catch((e) => logger.error(e));
  },
  null,
  true,
  REPORT_TIME_ZONE,
);

new CronJob(
  '0 5 17 * * 5', // At 05:05 PM, Fridays
  () => {
    jobReport('weekly').catch((e) => logger.error(e));
  },
  null,
  true,
  REPORT_TIME_ZONE,
);

async function reorders() {
  const tools = await Tool.getAutoReorders();
  const filtered = tools.filter((tool) => !tool.onOrder).filter(isReorderTool);
  const sorted = filtered.sort((a, b) => {
    if (a.supplier.name === b.supplier.name) {
      if (a.vendor.name === b.vendor.name) {
        return a.item > b.item ? 1 : -1;
      }
      return a.vendor.name > b.vendor.name ? 1 : -1;
    }
    return a.supplier.name > b.supplier.name ? 1 : -1;
  });

  const totalCost = sorted.reduce(
    (sum, tool) => sum + Number(tool.cost) * Number(tool.reorderQty),
    0,
  );

  let html = `<p style="color: #c62828; font-size: 18px; font-weight: 700; margin: 0;">Estimated Total: ${formatCurrency(totalCost)}</p><br>`;
  let supplier: string;
  let vendor: string;
  sorted.forEach((x) => {
    if (x.supplier.name !== supplier) {
      supplier = x.supplier.name;
      html += `<h3 style="text-decoration: underline">${escapeHtml(supplier)}</h3>`;
    }
    if (x.vendor.name !== vendor) {
      vendor = x.vendor.name;
      html += `<h4 style="margin-bottom: 0; padding-bottom: 0">${escapeHtml(vendor)}:</h4>`;
    }
    const orderLink = x.orderLink ? ` - <a href="${escapeHtml(x.orderLink)}">[Order]</a>` : '';
    html += `${escapeHtml(x.item)} - Qty: ${x.reorderQty} - $${x.cost}/ea.${orderLink}<br>`;
  });

  const recipients = await getToolReportRecipients();

  if (recipients.to.length === 0 && recipients.cc.length === 0) {
    logger.warn('Skipping tool reorder email because no recipients are configured.');
    return null;
  }

  return transporter.sendMail({
    from: 'noreply@bkmachine.net',
    to: recipients.to.join(', '),
    cc: recipients.cc.length ? recipients.cc.join(', ') : undefined,
    subject: 'Tool Reorders 🛒',
    html,
  });
}

async function jobReport(period: JobReportPeriod) {
  const recipients = await getJobReportRecipients(period);

  if (recipients.to.length === 0) {
    logger.warn(`Skipping ${period} job report email because no recipients are configured.`);
    return null;
  }

  const now = DateTime.now().setZone(REPORT_TIME_ZONE);
  const window = getReportWindow(period, now);
  const jobs = await loadJobsForReport(window.start.toJSDate(), window.end.toJSDate());
  const report = buildJobReport(jobs, window, now, period);

  return transporter.sendMail({
    from: 'noreply@bkmachine.net',
    to: recipients.to.join(', '),
    subject: report.subject,
    html: report.html,
    attachments: [
      {
        filename: report.csvFilename,
        content: report.csv,
        contentType: 'text/csv; charset=utf-8',
      },
    ],
  });
}

async function getToolReportRecipients(): Promise<{ to: string[]; cc: string[] }> {
  if (process.env.NODE_ENV !== 'production') {
    return {
      to: ['dave@bkmachine.net'],
      cc: [],
    };
  }

  const reports = await Reports.list();
  const to = new Set<string>();
  const cc = new Set<string>();

  for (const report of reports) {
    const email = String(report.email ?? '')
      .trim()
      .toLowerCase();
    if (!email) continue;
    if (report.tooling?.to) to.add(email);
    if (report.tooling?.cc) cc.add(email);
  }

  for (const email of to) {
    cc.delete(email);
  }

  return {
    to: [...to],
    cc: [...cc],
  };
}

async function getJobReportRecipients(
  period: JobReportPeriod,
): Promise<{ to: string[]; cc: string[] }> {
  if (process.env.NODE_ENV !== 'production') {
    return {
      to: ['dave@bkmachine.net'],
      cc: [],
    };
  }

  const reports = await Reports.list();
  const to = new Set<string>();

  for (const report of reports) {
    const email = String(report.email ?? '')
      .trim()
      .toLowerCase();
    if (!email) continue;

    if (period === 'daily' && report.jobs?.daily) to.add(email);
    if (period === 'weekly' && report.jobs?.weekly) to.add(email);
  }

  return {
    to: [...to],
    cc: [],
  };
}

function getReportWindow(period: JobReportPeriod, now: DateTime) {
  const end = now;

  if (period === 'daily') {
    return {
      start: now.startOf('day'),
      end,
    };
  }

  const daysSinceMonday = now.weekday - 1;
  return {
    start: now.startOf('day').minus({ days: daysSinceMonday }),
    end,
  };
}

async function loadJobsForReport(start: Date, end: Date): Promise<JobReportJob[]> {
  return (await JobModel.find({
    $or: [
      { startedOn: { $gte: start, $lt: end } },
      { completedOn: { $gte: start, $lt: end } },
      { 'productionTasks.startedAt': { $gte: start, $lt: end } },
      { 'productionTasks.endedAt': { $gte: start, $lt: end } },
    ],
  })
    .populate('customer')
    .populate('part')
    .sort({ jobNumber: 1 })) as unknown as JobReportJob[];
}

function buildJobReport(
  jobs: JobReportJob[],
  window: { start: DateTime; end: DateTime },
  now: DateTime,
  period: JobReportPeriod,
) {
  const startedJobs = jobs
    .filter((job) => isDateInWindow(getJobStartedTimestamp(job), window))
    .sort(compareReportJobs);
  const closedJobs = jobs
    .filter((job) => isDateInWindow(job.completedOn, window))
    .sort(compareReportJobs);

  const startedTasks = collectTaskEvents(jobs, window, now, 'startedAt');
  const stoppedTasks = collectTaskEvents(jobs, window, now, 'endedAt');

  return {
    subject: `Jobs ${formatPeriodLabel(period)} Report`,
    html: renderJobReportHtml(
      period,
      window,
      startedJobs,
      closedJobs,
      startedTasks,
      stoppedTasks,
      now,
    ),
    csvFilename: buildJobReportCsvFilename(period, window.end),
    csv: buildJobReportCsv(startedJobs, closedJobs, startedTasks, stoppedTasks),
  };
}

function collectTaskEvents(
  jobs: JobReportJob[],
  window: { start: DateTime; end: DateTime },
  now: DateTime,
  field: 'startedAt' | 'endedAt',
): JobReportTask[] {
  const results: JobReportTask[] = [];

  for (const job of jobs) {
    for (const task of job.productionTasks ?? []) {
      const dateValue = task[field];
      if (!isDateInWindow(dateValue, window)) continue;

      const businessDurationMs = calculateTaskBusinessDurationMs(
        task,
        {
          timeZone: REPORT_TIME_ZONE,
        },
        field === 'startedAt' ? now.toJSDate() : null,
      );
      if (businessDurationMs <= 0) continue;

      results.push({
        id: task.id,
        machineId: task.machineId,
        machineName: task.machineName,
        machineType: task.machineType,
        startedAt: task.startedAt,
        endedAt: task.endedAt,
        job,
        businessDurationMs,
      });
    }
  }

  results.sort((left, right) => compareReportTasks(left, right, field));

  return results.map((task) => ({
    ...task,
    endedAt: task.endedAt ?? (field === 'startedAt' ? now.toJSDate() : task.endedAt),
  }));
}

function renderJobReportHtml(
  period: JobReportPeriod,
  window: { start: DateTime; end: DateTime },
  startedJobs: JobReportJob[],
  closedJobs: JobReportJob[],
  startedTasks: JobReportTask[],
  stoppedTasks: JobReportTask[],
  now: DateTime,
) {
  const title = `Jobs ${formatPeriodLabel(period)} Report`;
  const windowLabel = `${window.start.toFormat('ccc, LLL d')} - ${window.end.toFormat('ccc, LLL d h:mm a')}`;
  const summary = `Estimated task times only count Monday-Friday 8:00 AM-5:00 PM ${REPORT_TIME_ZONE}.`;

  return `
    <div style="font-family: Arial, sans-serif; color: #222; line-height: 1.45;">
      <h2 style="margin: 0 0 6px 0;">${escapeHtml(title)}</h2>
      <div style="margin-bottom: 14px; color: #666;">${escapeHtml(windowLabel)}</div>
      <p style="margin: 0 0 18px 0; color: #444;">${escapeHtml(summary)}</p>
      ${renderSummaryCards(startedJobs.length, closedJobs.length, startedTasks.length, stoppedTasks.length)}
      ${renderJobSection('Jobs Started', startedJobs, (job) => renderJobRow(job, 'startedOn'))}
      ${renderJobSection('Jobs Closed', closedJobs, (job) => renderJobRow(job, 'completedOn'))}
      ${renderTaskSection('Tasks Started', startedTasks, now, 'startedAt')}
      ${renderTaskSection('Tasks Stopped', stoppedTasks, now, 'endedAt')}
    </div>
  `;
}

function renderSummaryCards(
  startedJobs: number,
  closedJobs: number,
  startedTasks: number,
  stoppedTasks: number,
) {
  return `
    <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 18px;">
      ${renderSummaryCard('Jobs Started', startedJobs)}
      ${renderSummaryCard('Jobs Closed', closedJobs)}
      ${renderSummaryCard('Tasks Started', startedTasks)}
      ${renderSummaryCard('Tasks Stopped', stoppedTasks)}
    </div>
  `;
}

function renderSummaryCard(label: string, value: number) {
  return `
    <div style="border: 1px solid #ddd; border-radius: 10px; padding: 12px; background: #fafafa;">
      <div style="font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.06em;">${escapeHtml(label)}</div>
      <div style="font-size: 26px; font-weight: 700; margin-top: 4px;">${value}</div>
    </div>
  `;
}

function renderJobSection(
  title: string,
  jobs: JobReportJob[],
  renderRow: (job: JobReportJob) => string,
) {
  if (!jobs.length) {
    return renderEmptySection(title, 'None in this period.');
  }

  return `
    <h3 style="margin: 18px 0 8px 0;">${escapeHtml(title)}</h3>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px;">
      <thead>
        <tr>
          ${tableHeader('Job #')}
          ${tableHeader('Customer')}
          ${tableHeader('Part')}
          ${tableHeader('Qty')}
          ${tableHeader('Time')}
        </tr>
      </thead>
      <tbody>
        ${jobs.map(renderRow).join('')}
      </tbody>
    </table>
  `;
}

function renderTaskSection(
  title: string,
  tasks: JobReportTask[],
  _now: DateTime,
  field: 'startedAt' | 'endedAt',
) {
  if (!tasks.length) {
    return renderEmptySection(title, 'None in this period.');
  }

  return `
    <h3 style="margin: 18px 0 8px 0;">${escapeHtml(title)}</h3>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px;">
      <thead>
        <tr>
          ${tableHeader('Job #')}
          ${tableHeader('Customer')}
          ${tableHeader('Part')}
          ${tableHeader('Machine')}
          ${tableHeader(field === 'startedAt' ? 'Started' : 'Stopped')}
          ${tableHeader('Est. Time')}
        </tr>
      </thead>
      <tbody>
        ${tasks
          .map((task) => {
            return renderTaskRow(task, field);
          })
          .join('')}
      </tbody>
    </table>
  `;
}

function renderEmptySection(title: string, message: string) {
  return `
    <h3 style="margin: 18px 0 8px 0;">${escapeHtml(title)}</h3>
    <div style="margin-bottom: 14px; color: #666;">${escapeHtml(message)}</div>
  `;
}

function renderJobRow(job: JobReportJob, field: 'startedOn' | 'completedOn') {
  const dateValue =
    field === 'startedOn'
      ? formatReportDate(getJobStartedTimestamp(job))
      : formatReportDate(job.completedOn);
  return `
    <tr>
      ${tableCell(job.jobNumber)}
      ${tableCell(getCustomerName(job))}
      ${tableCell(getPartName(job))}
      ${tableCell(job.qty)}
      ${tableCell(dateValue)}
    </tr>
  `;
}

function renderTaskRow(task: JobReportTask, field: 'startedAt' | 'endedAt') {
  const timestamp = field === 'startedAt' ? task.startedAt : task.endedAt;
  return `
    <tr>
      ${tableCell(task.job.jobNumber)}
      ${tableCell(getCustomerName(task.job))}
      ${tableCell(getPartName(task.job))}
      ${tableCell(task.machineName)}
      ${tableCell(formatReportDate(timestamp))}
      ${tableCell(formatDuration(task.businessDurationMs))}
    </tr>
  `;
}

function tableHeader(label: string) {
  return `<th style="text-align:left; padding: 8px; border-bottom: 1px solid #ddd; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #666;">${escapeHtml(label)}</th>`;
}

function tableCell(value: string | number) {
  return `<td style="padding: 8px; border-bottom: 1px solid #eee; vertical-align: top;">${escapeHtml(String(value))}</td>`;
}

function getCustomerName(job: JobReportJob) {
  if (job.customerName) return job.customerName;
  if (typeof job.customer === 'string') return '';
  return job.customer?.name || '';
}

function compareReportJobs(left: JobReportJob, right: JobReportJob) {
  return compareCustomerAndJob(left, right);
}

function compareReportTasks(
  left: JobReportTask,
  right: JobReportTask,
  field: 'startedAt' | 'endedAt',
) {
  const customerAndJob = compareCustomerAndJob(left.job, right.job);
  if (customerAndJob !== 0) return customerAndJob;

  const leftValue = field === 'startedAt' ? left.startedAt : left.endedAt;
  const rightValue = field === 'startedAt' ? right.startedAt : right.endedAt;
  const eventTime = compareDates(leftValue, rightValue);
  if (eventTime !== 0) return eventTime;

  return left.machineName.localeCompare(right.machineName);
}

function compareCustomerAndJob(left: JobReportJob, right: JobReportJob) {
  const customerComparison = getCustomerName(left).localeCompare(
    getCustomerName(right),
    undefined,
    {
      sensitivity: 'base',
    },
  );
  if (customerComparison !== 0) return customerComparison;

  return left.jobNumber - right.jobNumber;
}

function getPartName(job: JobReportJob) {
  const partNumber = typeof job.part === 'string' ? '' : job.part?.part || '';
  const partDescription = typeof job.part === 'string' ? '' : job.part?.description || '';
  return [partNumber || job.partNumber || '', partDescription || job.partDescription || '']
    .filter(Boolean)
    .join(' / ');
}

function getJobStartedTimestamp(job: JobReportJob) {
  const jobStartedAt = normalizeReportDate(job.startedOn) ?? normalizeReportDate(job.createdAt);
  const earliestTaskStart = normalizeReportDate(
    (job.productionTasks ?? [])
      .map((task) => task.startedAt)
      .sort((left, right) => compareDates(left, right))[0],
  );

  return earliestTaskStart ?? jobStartedAt ?? null;
}

function normalizeReportDate(value: string | Date | null | undefined) {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatReportDate(value: string | Date | null | undefined) {
  if (!value) return '—';
  const date = normalizeReportDate(value);
  if (!date) return '—';

  return DateTime.fromJSDate(date, { zone: REPORT_TIME_ZONE }).toFormat('ccc LLL d, h:mm a');
}

function formatDuration(valueMs: number) {
  const totalSeconds = Math.max(0, Math.round(valueMs / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;

  const totalMinutes = Math.round(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

function buildJobReportCsvFilename(period: JobReportPeriod, end: DateTime) {
  return `jobs-${period}-report-${end.toFormat('yyyy-LL-dd')}.csv`;
}

function buildJobReportCsv(
  startedJobs: JobReportJob[],
  closedJobs: JobReportJob[],
  startedTasks: JobReportTask[],
  stoppedTasks: JobReportTask[],
) {
  const header = [
    'section',
    'jobNumber',
    'customer',
    'part',
    'qty',
    'machine',
    'eventTime',
    'estimatedTime',
  ];

  const rows = [
    ...startedJobs.map((job) => [
      'Jobs Started',
      String(job.jobNumber),
      getCustomerName(job),
      getPartName(job),
      String(job.qty),
      '',
      formatCsvDate(getJobStartedTimestamp(job)),
      '',
    ]),
    ...closedJobs.map((job) => [
      'Jobs Closed',
      String(job.jobNumber),
      getCustomerName(job),
      getPartName(job),
      String(job.qty),
      '',
      formatCsvDate(job.completedOn),
      '',
    ]),
    ...startedTasks.map((task) => [
      'Tasks Started',
      String(task.job.jobNumber),
      getCustomerName(task.job),
      getPartName(task.job),
      '',
      task.machineName,
      formatCsvDate(task.startedAt),
      formatDuration(task.businessDurationMs),
    ]),
    ...stoppedTasks.map((task) => [
      'Tasks Stopped',
      String(task.job.jobNumber),
      getCustomerName(task.job),
      getPartName(task.job),
      '',
      task.machineName,
      formatCsvDate(task.endedAt),
      formatDuration(task.businessDurationMs),
    ]),
  ];

  return [header, ...rows].map((row) => row.map(escapeCsvValue).join(',')).join('\n');
}

function formatCsvDate(value: string | Date | null | undefined) {
  const date = normalizeReportDate(value);
  if (!date) return '';

  return DateTime.fromJSDate(date, { zone: REPORT_TIME_ZONE }).toFormat('yyyy-LL-dd HH:mm:ss');
}

function escapeCsvValue(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function isDateInWindow(
  value: string | Date | null | undefined,
  window: { start: DateTime; end: DateTime },
) {
  if (!value) return false;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const dt = DateTime.fromJSDate(date, { zone: REPORT_TIME_ZONE });
  return dt >= window.start && dt < window.end;
}

function compareDates(
  left: string | Date | null | undefined,
  right: string | Date | null | undefined,
) {
  return toTimestamp(left) - toTimestamp(right);
}

function toTimestamp(value: string | Date | null | undefined) {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? 0 : time;
}

function formatPeriodLabel(period: JobReportPeriod) {
  return period === 'daily' ? 'Daily' : 'Weekly';
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

export default {
  reorders,
  jobReport,
};

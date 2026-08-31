import { calculateTaskBusinessDurationMs } from '@repo/utilities/time';
import { DateTime } from 'luxon';
import type { Transporter } from 'nodemailer';
import JobModel from '../database/lib/job/job_model.js';
import Reports from '../database/lib/report/report_service.js';
import logger from '../logger.js';

const REPORT_TIME_ZONE = 'America/Denver';

export type JobReportPeriod = 'daily' | 'weekly';

type JobReportJob = Job & {
  customer?: Customer | string;
  part?: Part | string;
};

type JobReportTask = JobProductionTask & {
  job: JobReportJob;
  businessDurationMs: number;
};

export async function sendProductionReport(transporter: Transporter, period: JobReportPeriod) {
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

async function getJobReportRecipients(
  period: JobReportPeriod,
): Promise<{ to: string[]; cc: string[] }> {
  if (process.env.NODE_ENV !== 'production') {
    return { to: ['dave@bkmachine.net'], cc: [] };
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

  return { to: [...to], cc: [] };
}

function getReportWindow(period: JobReportPeriod, now: DateTime) {
  if (period === 'daily') return { start: now.startOf('day'), end: now };

  return {
    start: now.startOf('day').minus({ days: now.weekday - 1 }),
    end: now,
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
    html: renderJobReportHtml(period, window, startedJobs, closedJobs, startedTasks, stoppedTasks),
    csvFilename: `jobs-${period}-report-${window.end.toFormat('yyyy-LL-dd')}.csv`,
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
      if (!isDateInWindow(task[field], window)) continue;
      const businessDurationMs = calculateTaskBusinessDurationMs(
        task,
        { timeZone: REPORT_TIME_ZONE },
        field === 'startedAt' ? now.toJSDate() : null,
      );
      if (businessDurationMs <= 0) continue;
      results.push({ ...task, job, businessDurationMs });
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
) {
  const title = `Jobs ${formatPeriodLabel(period)} Report`;
  const windowLabel = `${window.start.toFormat('ccc, LLL d')} - ${window.end.toFormat('ccc, LLL d h:mm a')}`;
  return `<div style="font-family: Arial, sans-serif; color: #222; line-height: 1.45;">
    <h2 style="margin: 0 0 6px 0;">${escapeHtml(title)}</h2>
    <div style="margin-bottom: 14px; color: #666;">${escapeHtml(windowLabel)}</div>
    <p style="margin: 0 0 18px 0; color: #444;">Estimated task times only count Monday-Friday 8:00 AM-5:00 PM ${REPORT_TIME_ZONE}.</p>
    ${renderSummaryCards(startedJobs.length, closedJobs.length, startedTasks.length, stoppedTasks.length)}
    ${renderJobSection('Jobs Started', startedJobs, (job) => renderJobRow(job, 'startedOn'))}
    ${renderJobSection('Jobs Closed', closedJobs, (job) => renderJobRow(job, 'completedOn'))}
    ${renderTaskSection('Tasks Started', startedTasks, 'startedAt')}
    ${renderTaskSection('Tasks Stopped', stoppedTasks, 'endedAt')}
  </div>`;
}

function renderSummaryCards(
  startedJobs: number,
  closedJobs: number,
  startedTasks: number,
  stoppedTasks: number,
) {
  return `<div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 18px;">
    ${renderSummaryCard('Jobs Started', startedJobs)}${renderSummaryCard('Jobs Closed', closedJobs)}
    ${renderSummaryCard('Tasks Started', startedTasks)}${renderSummaryCard('Tasks Stopped', stoppedTasks)}
  </div>`;
}

function renderSummaryCard(label: string, value: number) {
  return `<div style="border: 1px solid #ddd; border-radius: 10px; padding: 12px; background: #fafafa;"><div style="font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.06em;">${escapeHtml(label)}</div><div style="font-size: 26px; font-weight: 700; margin-top: 4px;">${value}</div></div>`;
}

function renderJobSection(
  title: string,
  jobs: JobReportJob[],
  renderRow: (job: JobReportJob) => string,
) {
  if (!jobs.length) return renderEmptySection(title);
  return `<h3 style="margin: 18px 0 8px 0;">${escapeHtml(title)}</h3><table style="width: 100%; border-collapse: collapse; margin-bottom: 14px;"><thead><tr>${tableHeader('Job #')}${tableHeader('Customer')}${tableHeader('Part')}${tableHeader('Qty')}${tableHeader('Time')}</tr></thead><tbody>${jobs.map(renderRow).join('')}</tbody></table>`;
}

function renderTaskSection(title: string, tasks: JobReportTask[], field: 'startedAt' | 'endedAt') {
  if (!tasks.length) return renderEmptySection(title);
  return `<h3 style="margin: 18px 0 8px 0;">${escapeHtml(title)}</h3><table style="width: 100%; border-collapse: collapse; margin-bottom: 14px;"><thead><tr>${tableHeader('Job #')}${tableHeader('Customer')}${tableHeader('Part')}${tableHeader('Machine')}${tableHeader(field === 'startedAt' ? 'Started' : 'Stopped')}${tableHeader('Est. Time')}</tr></thead><tbody>${tasks.map((task) => renderTaskRow(task, field)).join('')}</tbody></table>`;
}

function renderEmptySection(title: string) {
  return `<h3 style="margin: 18px 0 8px 0;">${escapeHtml(title)}</h3><div style="margin-bottom: 14px; color: #666;">None in this period.</div>`;
}

function renderJobRow(job: JobReportJob, field: 'startedOn' | 'completedOn') {
  const timestamp = field === 'startedOn' ? getJobStartedTimestamp(job) : job.completedOn;
  return `<tr>${tableCell(job.jobNumber)}${tableCell(getCustomerName(job))}${tableCell(getPartName(job))}${tableCell(job.qty)}${tableCell(formatReportDate(timestamp))}</tr>`;
}

function renderTaskRow(task: JobReportTask, field: 'startedAt' | 'endedAt') {
  const timestamp = field === 'startedAt' ? task.startedAt : task.endedAt;
  return `<tr>${tableCell(task.job.jobNumber)}${tableCell(getCustomerName(task.job))}${tableCell(getPartName(task.job))}${tableCell(task.machineName)}${tableCell(formatReportDate(timestamp))}${tableCell(formatDuration(task.businessDurationMs))}</tr>`;
}

function tableHeader(label: string) {
  return `<th style="text-align:left; padding: 8px; border-bottom: 1px solid #ddd; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #666;">${escapeHtml(label)}</th>`;
}

function tableCell(value: string | number) {
  return `<td style="padding: 8px; border-bottom: 1px solid #eee; vertical-align: top;">${escapeHtml(String(value))}</td>`;
}

function getCustomerName(job: JobReportJob) {
  if (job.customerName) return job.customerName;
  return typeof job.customer === 'string' ? '' : job.customer?.name || '';
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
    (job.productionTasks ?? []).map((task) => task.startedAt).sort(compareDates)[0],
  );
  return earliestTaskStart ?? jobStartedAt ?? null;
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
  return (
    compareDates(
      field === 'startedAt' ? left.startedAt : left.endedAt,
      field === 'startedAt' ? right.startedAt : right.endedAt,
    ) || String(left.machineName ?? '').localeCompare(String(right.machineName ?? ''))
  );
}

function compareCustomerAndJob(left: JobReportJob, right: JobReportJob) {
  return (
    getCustomerName(left).localeCompare(getCustomerName(right), undefined, {
      sensitivity: 'base',
    }) || left.jobNumber - right.jobNumber
  );
}

function normalizeReportDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatReportDate(value: string | Date | null | undefined) {
  const date = normalizeReportDate(value);
  return date
    ? DateTime.fromJSDate(date, { zone: REPORT_TIME_ZONE }).toFormat('ccc LLL d, h:mm a')
    : '—';
}

function formatDuration(valueMs: number) {
  const totalSeconds = Math.max(0, Math.round(valueMs / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const totalMinutes = Math.round(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours === 0 ? `${minutes}m` : `${hours}h ${String(minutes).padStart(2, '0')}m`;
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
  return date
    ? DateTime.fromJSDate(date, { zone: REPORT_TIME_ZONE }).toFormat('yyyy-LL-dd HH:mm:ss')
    : '';
}

function escapeCsvValue(value: unknown) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function isDateInWindow(
  value: string | Date | null | undefined,
  window: { start: DateTime; end: DateTime },
) {
  const date = normalizeReportDate(value);
  if (!date) return false;
  const dateTime = DateTime.fromJSDate(date, { zone: REPORT_TIME_ZONE });
  return dateTime >= window.start && dateTime < window.end;
}

function compareDates(
  left: string | Date | null | undefined,
  right: string | Date | null | undefined,
) {
  return toTimestamp(left) - toTimestamp(right);
}

function toTimestamp(value: string | Date | null | undefined) {
  return normalizeReportDate(value)?.getTime() ?? 0;
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

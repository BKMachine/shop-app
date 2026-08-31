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

type JobReportShipment = JobShipmentRecord & {
  job: JobReportJob;
};

export async function sendProductionReport(
  transporter: Transporter,
  period: JobReportPeriod,
  reportDate?: string,
) {
  const recipients = await getJobReportRecipients(period);

  if (recipients.to.length === 0) {
    logger.warn(`Skipping ${period} job report email because no recipients are configured.`);
    return null;
  }

  const now = getReportNow(reportDate);
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

function getReportNow(reportDate?: string) {
  if (!reportDate) return DateTime.now().setZone(REPORT_TIME_ZONE);

  const selectedDate = DateTime.fromISO(reportDate, { zone: REPORT_TIME_ZONE });
  if (!selectedDate.isValid) throw new Error('Invalid report date.');
  return selectedDate.endOf('day');
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
      { createdAt: { $gte: start, $lt: end } },
      { startedOn: { $gte: start, $lt: end } },
      { completedOn: { $gte: start, $lt: end } },
      { 'productionTasks.startedAt': { $gte: start, $lt: end } },
      { 'productionTasks.endedAt': { $gte: start, $lt: end } },
      { 'shipmentRecords.shippedAt': { $gte: start, $lt: end } },
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
  const createdJobs = jobs
    .filter((job) => isDateInWindow(job.createdAt, window))
    .sort(compareReportJobs);
  const startedJobs = jobs
    .filter((job) => isDateInWindow(getJobStartedTimestamp(job), window))
    .sort(compareReportJobs);
  const closedJobs = jobs
    .filter((job) => isDateInWindow(job.completedOn, window))
    .sort(compareReportJobs);
  const startedTasks = collectTaskEvents(jobs, window, now, 'startedAt');
  const stoppedTasks = collectTaskEvents(jobs, window, now, 'endedAt');
  const shipments = collectShipments(jobs, window);

  return {
    subject: `Jobs ${formatPeriodLabel(period)} Report`,
    html: renderJobReportHtml(
      period,
      window,
      createdJobs,
      startedJobs,
      closedJobs,
      startedTasks,
      stoppedTasks,
      shipments,
    ),
    csvFilename: `jobs-${period}-report-${window.end.toFormat('yyyy-LL-dd')}.csv`,
    csv: buildJobReportCsv(
      createdJobs,
      startedJobs,
      closedJobs,
      startedTasks,
      stoppedTasks,
      shipments,
    ),
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

function collectShipments(
  jobs: JobReportJob[],
  window: { start: DateTime; end: DateTime },
): JobReportShipment[] {
  const shipments = jobs.flatMap((job) =>
    (job.shipmentRecords ?? [])
      .filter((shipment) => isDateInWindow(shipment.shippedAt, window))
      .map((shipment) => ({
        id: shipment.id,
        shippedAt: shipment.shippedAt,
        qty: shipment.qty,
        po: shipment.po,
        job,
      })),
  );
  return shipments.sort((left, right) => {
    const customerAndJob = compareCustomerAndJob(left.job, right.job);
    return customerAndJob || compareDates(left.shippedAt, right.shippedAt);
  });
}

function renderJobReportHtml(
  period: JobReportPeriod,
  window: { start: DateTime; end: DateTime },
  createdJobs: JobReportJob[],
  startedJobs: JobReportJob[],
  closedJobs: JobReportJob[],
  startedTasks: JobReportTask[],
  stoppedTasks: JobReportTask[],
  shipments: JobReportShipment[],
) {
  const title = `Jobs ${formatPeriodLabel(period)} Report`;
  const windowLabel = `${window.start.toFormat('ccc, LLL d')} - ${window.end.toFormat('ccc, LLL d h:mm a')}`;
  return `<div style="font-family: Arial, sans-serif; color: #222; line-height: 1.45;">
    <h2 style="margin: 0 0 6px 0;">${escapeHtml(title)}</h2>
    <div style="margin-bottom: 14px; color: #666;">${escapeHtml(windowLabel)}</div>
    <p style="margin: 0 0 18px 0; color: #444;">Estimated task times only count Monday-Friday 8:00 AM-5:00 PM ${REPORT_TIME_ZONE}.</p>
    ${renderSummaryCards(
      createdJobs.length,
      startedJobs.length,
      startedTasks.length,
      stoppedTasks.length,
      shipments.length,
      closedJobs.length,
    )}
    ${renderCreatedJobSection(createdJobs)}
    ${renderJobSection('Jobs Started', startedJobs, 'Time', (job) =>
      renderJobRow(job, 'startedOn'),
    )}
    ${renderTaskSection('Tasks Started', startedTasks, 'startedAt')}
    ${renderTaskSection('Tasks Stopped', stoppedTasks, 'endedAt')}
    ${renderShipmentSection(shipments)}
    ${renderJobSection('Jobs Closed', closedJobs, 'Est. Days', (job) =>
      renderJobRow(job, 'completedOn'),
    )}
  </div>`;
}

function renderSummaryCards(
  createdJobs: number,
  startedJobs: number,
  startedTasks: number,
  stoppedTasks: number,
  shipments: number,
  closedJobs: number,
) {
  return `<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-bottom: 18px;">
    ${renderSummaryCard('Jobs Created', createdJobs)}${renderSummaryCard('Jobs Started', startedJobs)}
    ${renderSummaryCard('Tasks Started', startedTasks)}${renderSummaryCard('Tasks Stopped', stoppedTasks)}
    ${renderSummaryCard('Shipments Made', shipments)}${renderSummaryCard('Jobs Closed', closedJobs)}
  </div>`;
}

function renderSummaryCard(label: string, value: number) {
  return `<div style="border: 1px solid #ddd; border-radius: 10px; padding: 12px; background: #fafafa;"><div style="font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.06em;">${escapeHtml(label)}</div><div style="font-size: 26px; font-weight: 700; margin-top: 4px;">${value}</div></div>`;
}

function renderJobSection(
  title: string,
  jobs: JobReportJob[],
  timeHeader: string,
  renderRow: (job: JobReportJob) => string,
) {
  if (!jobs.length) return renderEmptySection(title);
  return `<h3 style="margin: 18px 0 8px 0;">${escapeHtml(title)}</h3><table style="width: 100%; table-layout: fixed; border-collapse: collapse; margin-bottom: 14px;">${tableColumns(['6%', '14%', '30%', '8%', '30%', '12%'])}<thead><tr>${tableHeader('Job #')}${tableHeader('Customer')}${tableHeader('Part')}${tableHeader('Qty')}${tableHeader(timeHeader)}${tableHeader('PO #s')}</tr></thead><tbody>${jobs.map(renderRow).join('')}</tbody></table>`;
}

function renderCreatedJobSection(jobs: JobReportJob[]) {
  if (!jobs.length) return renderEmptySection('Jobs Created');
  return `<h3 style="margin: 18px 0 8px 0;">Jobs Created</h3><table style="width: 100%; table-layout: fixed; border-collapse: collapse; margin-bottom: 14px;">${tableColumns(['6%', '14%', '30%', '8%', '30%', '12%'])}<thead><tr>${tableHeader('Job #')}${tableHeader('Customer')}${tableHeader('Part')}${tableHeader('Qty')}${tableHeader('Created')}${tableHeader('PO #s')}</tr></thead><tbody>${jobs.map(renderCreatedJobRow).join('')}</tbody></table>`;
}

function renderTaskSection(title: string, tasks: JobReportTask[], field: 'startedAt' | 'endedAt') {
  if (!tasks.length) return renderEmptySection(title);
  const isStarted = field === 'startedAt';
  const includeEventTime = true;
  const includeDuration = field === 'endedAt';
  const includeMachiningComplete = field === 'endedAt';
  const includeProductionQty = field === 'endedAt';
  const widths = includeDuration
    ? ['6%', '14%', '28%', '10%', '8%', '7%', '8%', '5%', '12%']
    : ['6%', '14%', '35%', '18%', '15%', '12%'];
  const eventTimeHeader = includeEventTime ? tableHeader(isStarted ? 'Started' : 'Stopped') : '';
  const taskHeaders = isStarted
    ? `${eventTimeHeader}${tableHeader('Machine')}`
    : `${eventTimeHeader}${tableHeader('Machine')}`;
  return `<h3 style="margin: 18px 0 8px 0;">${escapeHtml(title)}</h3><table style="width: 100%; table-layout: fixed; border-collapse: collapse; margin-bottom: 14px;">${tableColumns(widths)}<thead><tr>${tableHeader('Job #')}${tableHeader('Customer')}${tableHeader('Part')}${taskHeaders}${includeDuration ? tableHeader('Est. Days') : ''}${includeMachiningComplete ? tableHeader('Machining Complete') : ''}${includeProductionQty ? tableHeader('Production Qty') : ''}${tableHeader('PO #s')}</tr></thead><tbody>${tasks.map((task) => renderTaskRow(task, field, includeEventTime, includeDuration, includeMachiningComplete, includeProductionQty)).join('')}</tbody></table>`;
}

function renderShipmentSection(shipments: JobReportShipment[]) {
  if (!shipments.length) return renderEmptySection('Shipments Made');
  return `<h3 style="margin: 18px 0 8px 0;">Shipments Made</h3><table style="width: 100%; table-layout: fixed; border-collapse: collapse; margin-bottom: 14px;">${tableColumns(['6%', '14%', '30%', '10%', '20%', '20%'])}<thead><tr>${tableHeader('Job #')}${tableHeader('Customer')}${tableHeader('Part')}${tableHeader('Qty Shipped')}${tableHeader('Date Shipped')}${tableHeader('PO')}</tr></thead><tbody>${shipments.map(renderShipmentRow).join('')}</tbody></table>`;
}

function renderEmptySection(title: string) {
  return `<h3 style="margin: 18px 0 8px 0;">${escapeHtml(title)}</h3><div style="margin-bottom: 14px; color: #666;">None in this period.</div>`;
}

function renderJobRow(job: JobReportJob, field: 'startedOn' | 'completedOn') {
  const value =
    field === 'startedOn'
      ? formatReportDate(getJobStartedTimestamp(job))
      : formatBusinessDays(getJobProductionDurationMs(job));
  return `<tr>${tableCell(job.jobNumber)}${tableCell(getCustomerName(job))}${tableCell(getPartName(job))}${tableCell(job.qty)}${tableCell(value)}${tableCell(formatJobPurchaseOrders(job))}</tr>`;
}

function renderCreatedJobRow(job: JobReportJob) {
  return `<tr>${tableCell(job.jobNumber)}${tableCell(getCustomerName(job))}${tableCell(getPartName(job))}${tableCell(job.qty)}${tableCell(formatReportDate(job.createdAt))}${tableCell(formatJobPurchaseOrders(job))}</tr>`;
}

function renderTaskRow(
  task: JobReportTask,
  field: 'startedAt' | 'endedAt',
  includeEventTime: boolean,
  includeDuration: boolean,
  includeMachiningComplete: boolean,
  includeProductionQty: boolean,
) {
  const timestamp = field === 'startedAt' ? task.startedAt : task.endedAt;
  const isMachiningComplete = task.job.status === 'machining_complete';
  const productionQty = isMachiningComplete ? String(task.job.actualProductionQty ?? '') : '';
  const eventTimeCell = includeEventTime ? tableCell(formatReportDate(timestamp)) : '';
  const taskCells =
    field === 'startedAt'
      ? `${eventTimeCell}${tableCell(task.machineName)}`
      : `${eventTimeCell}${tableCell(task.machineName)}`;
  return `<tr>${tableCell(task.job.jobNumber)}${tableCell(getCustomerName(task.job))}${tableCell(getPartName(task.job))}${taskCells}${includeDuration ? tableCell(formatBusinessDays(task.businessDurationMs)) : ''}${includeMachiningComplete ? tableCell(isMachiningComplete ? '[x]' : '[ ]') : ''}${includeProductionQty ? tableCell(productionQty) : ''}${tableCell(formatJobPurchaseOrders(task.job))}</tr>`;
}

function renderShipmentRow(shipment: JobReportShipment) {
  return `<tr>${tableCell(shipment.job.jobNumber)}${tableCell(getCustomerName(shipment.job))}${tableCell(getPartName(shipment.job))}${tableCell(shipment.qty)}${tableCell(formatShipmentDate(shipment.shippedAt))}${tableCell(shipment.po || shipment.job.customerPo || '')}</tr>`;
}

function tableHeader(label: string) {
  return `<th style="text-align:left; padding: 8px; border-bottom: 1px solid #ddd; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #666;">${escapeHtml(label)}</th>`;
}

function tableColumns(widths: string[]) {
  return `<colgroup>${widths.map((width) => `<col style="width: ${width};">`).join('')}</colgroup>`;
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

function getJobPurchaseOrders(job: JobReportJob) {
  return [
    ...new Set(
      [job.customerPo, ...(job.shipmentSchedule ?? []).map((shipment) => shipment.po)]
        .map((po) => po?.trim())
        .filter((po): po is string => Boolean(po)),
    ),
  ];
}

function formatJobPurchaseOrders(job: JobReportJob) {
  return getJobPurchaseOrders(job).join(', ');
}

function getJobStartedTimestamp(job: JobReportJob) {
  const jobStartedAt = normalizeReportDate(job.startedOn) ?? normalizeReportDate(job.createdAt);
  const earliestTaskStart = normalizeReportDate(
    (job.productionTasks ?? []).map((task) => task.startedAt).sort(compareDates)[0],
  );
  return earliestTaskStart ?? jobStartedAt ?? null;
}

function getJobProductionDurationMs(job: JobReportJob) {
  return (job.productionTasks ?? []).reduce(
    (total, task) =>
      total + calculateTaskBusinessDurationMs(task, { timeZone: REPORT_TIME_ZONE }, null),
    0,
  );
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

function formatShipmentDate(value: string | Date | null | undefined) {
  const date = normalizeReportDate(value);
  return date ? DateTime.fromJSDate(date, { zone: REPORT_TIME_ZONE }).toFormat('ccc LLL d') : '—';
}

function formatBusinessDays(valueMs: number) {
  return `${(Math.max(0, valueMs) / (8 * 60 * 60 * 1000)).toFixed(1)} days`;
}

function formatHours(valueMs: number) {
  return `${(Math.max(0, valueMs) / (60 * 60 * 1000)).toFixed(1)} hours`;
}

function buildJobReportCsv(
  createdJobs: JobReportJob[],
  startedJobs: JobReportJob[],
  closedJobs: JobReportJob[],
  startedTasks: JobReportTask[],
  stoppedTasks: JobReportTask[],
  shipments: JobReportShipment[],
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
    'machiningComplete',
    'productionQty',
    'po',
    'jobPoNumbers',
  ];
  const rows = [
    ...createdJobs.map((job) => [
      'Jobs Created',
      String(job.jobNumber),
      getCustomerName(job),
      getPartName(job),
      String(job.qty),
      '',
      formatCsvDate(job.createdAt),
      '',
      '',
      '',
      formatJobPurchaseOrdersCsv(job),
      '',
    ]),
    ...startedJobs.map((job) => [
      'Jobs Started',
      String(job.jobNumber),
      getCustomerName(job),
      getPartName(job),
      String(job.qty),
      '',
      formatCsvDate(getJobStartedTimestamp(job)),
      '',
      '',
      formatJobPurchaseOrdersCsv(job),
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
      '',
      '',
      '',
      formatJobPurchaseOrdersCsv(task.job),
      '',
    ]),
    ...stoppedTasks.map((task) => [
      'Tasks Stopped',
      String(task.job.jobNumber),
      getCustomerName(task.job),
      getPartName(task.job),
      '',
      task.machineName,
      formatCsvDate(task.endedAt),
      formatHours(task.businessDurationMs),
      task.job.status === 'machining_complete' ? 'true' : 'false',
      task.job.status === 'machining_complete' ? String(task.job.actualProductionQty ?? '') : '',
      '',
      formatJobPurchaseOrdersCsv(task.job),
    ]),
    ...shipments.map((shipment) => [
      'Shipments Made',
      String(shipment.job.jobNumber),
      getCustomerName(shipment.job),
      getPartName(shipment.job),
      String(shipment.qty),
      '',
      formatShipmentCsvDate(shipment.shippedAt),
      '',
      '',
      '',
      shipment.po || shipment.job.customerPo || '',
      formatJobPurchaseOrdersCsv(shipment.job),
    ]),
    ...closedJobs.map((job) => [
      'Jobs Closed',
      String(job.jobNumber),
      getCustomerName(job),
      getPartName(job),
      String(job.qty),
      '',
      formatCsvDate(job.completedOn),
      formatHours(getJobProductionDurationMs(job)),
      '',
      '',
      '',
      formatJobPurchaseOrdersCsv(job),
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

function formatShipmentCsvDate(value: string | Date | null | undefined) {
  const date = normalizeReportDate(value);
  return date ? DateTime.fromJSDate(date, { zone: REPORT_TIME_ZONE }).toFormat('yyyy-LL-dd') : '';
}

function formatJobPurchaseOrdersCsv(job: JobReportJob) {
  return JSON.stringify(getJobPurchaseOrders(job));
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

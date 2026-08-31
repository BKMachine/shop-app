import { CronJob } from 'cron';
import nodemailer from 'nodemailer';
import Reports from '../database/lib/report/report_service.js';
import type { ToolPopulatedDoc } from '../database/lib/tool/tool_model.js';
import Tool from '../database/lib/tool/tool_service.js';
import logger from '../logger.js';
import { type JobReportPeriod, sendProductionReport } from './production_report_service.js';

const REPORT_TIME_ZONE = 'America/Denver';

type ReorderTool = ToolPopulatedDoc & {
  vendor: Vendor;
  supplier: Supplier;
  item: string;
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
  '0 0 8 * * 1',
  () => {
    reorders().catch((error) => logger.error(error));
  },
  null,
  true,
  REPORT_TIME_ZONE,
);

new CronJob(
  '0 0 17 * * 1-5',
  () => {
    jobReport('daily').catch((error) => logger.error(error));
  },
  null,
  true,
  REPORT_TIME_ZONE,
);

new CronJob(
  '0 5 17 * * 5',
  () => {
    jobReport('weekly').catch((error) => logger.error(error));
  },
  null,
  true,
  REPORT_TIME_ZONE,
);

async function reorders() {
  const tools = await Tool.getAutoReorders();
  const sorted = tools
    .filter((tool) => !tool.onOrder)
    .filter(isReorderTool)
    .sort((left, right) => {
      if (left.supplier.name === right.supplier.name) {
        if (left.vendor.name === right.vendor.name) return left.item > right.item ? 1 : -1;
        return left.vendor.name > right.vendor.name ? 1 : -1;
      }
      return left.supplier.name > right.supplier.name ? 1 : -1;
    });
  const totalCost = sorted.reduce(
    (sum, tool) => sum + Number(tool.cost) * Number(tool.reorderQty),
    0,
  );

  let html = `<p style="color: #c62828; font-size: 18px; font-weight: 700; margin: 0;">Estimated Total: ${formatCurrency(totalCost)}</p><br>`;
  let supplier: string;
  let vendor: string;
  sorted.forEach((tool) => {
    if (tool.supplier.name !== supplier) {
      supplier = tool.supplier.name;
      html += `<h3 style="text-decoration: underline">${escapeHtml(supplier)}</h3>`;
    }
    if (tool.vendor.name !== vendor) {
      vendor = tool.vendor.name;
      html += `<h4 style="margin-bottom: 0; padding-bottom: 0">${escapeHtml(vendor)}:</h4>`;
    }
    const orderLink = tool.orderLink
      ? ` - <a href="${escapeHtml(tool.orderLink)}">[Order]</a>`
      : '';
    html += `${escapeHtml(tool.item)} - Qty: ${tool.reorderQty} - $${tool.cost}/ea.${orderLink}<br>`;
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
  return sendProductionReport(transporter, period);
}

async function getToolReportRecipients(): Promise<{ to: string[]; cc: string[] }> {
  if (process.env.NODE_ENV !== 'production') return { to: ['dave@bkmachine.net'], cc: [] };

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
  for (const email of to) cc.delete(email);
  return { to: [...to], cc: [...cc] };
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
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export default {
  reorders,
  jobReport,
};

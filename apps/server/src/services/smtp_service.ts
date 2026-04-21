import { CronJob } from 'cron';
import nodemailer from 'nodemailer';
import Reports from '../database/lib/report/report_service.js';
import type { ToolPopulatedDoc } from '../database/lib/tool/tool_model.js';
import Tool from '../database/lib/tool/tool_service.js';
import logger from '../logger.js';

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
  '0 0 8 * * 1', // At 08:00 AM, only on Monday
  () => {
    reorders().catch((e) => logger.error(e));
  },
  null,
  true,
  'America/Denver',
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

  let html = '';
  let supplier: string;
  let vendor: string;
  sorted.forEach((x) => {
    if (x.supplier.name !== supplier) {
      supplier = x.supplier.name;
      html += `<h3 style="text-decoration: underline">${supplier}</h3>`;
    }
    if (x.vendor.name !== vendor) {
      vendor = x.vendor.name;
      html += `<h4 style="margin-bottom: 0; padding-bottom: 0">${vendor}:</h4>`;
    }
    const orderLink = x.orderLink ? ` - <a href="${x.orderLink}">[Order]</a>` : '';
    html += `${x.item} - Qty: ${x.reorderQty} - $${x.cost}/ea.${orderLink}<br>`;
  });

  const recipients = await getReportRecipients();

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

async function getReportRecipients(): Promise<{ to: string[]; cc: string[] }> {
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

export default {
  reorders,
};

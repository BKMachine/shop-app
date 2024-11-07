import { CronJob } from 'cron';
import nodemailer from 'nodemailer';
import Tool from '../database/lib/tool';
import logger from '../logger';

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
  function () {
    reorders().catch((e) => logger.error(e));
  },
  null,
  true,
  'America/Denver',
);

async function reorders() {
  const tools = (await Tool.getAutoReorders()) as ToolDocReorders[];
  const filtered = tools.filter((x) => !x.onOrder && x.vendor);
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
    html += `${x.item} - Qty: ${x.reorderQty}<br>`;
  });

  let to: string[] = ['dave@bkmachine.net'];
  if (process.env.NODE_ENV === 'production') to.push('jeff@bkmachine.net');

  return transporter.sendMail({
    from: 'noreply@bkmachine.net',
    to: to.join(', '),
    subject: 'Tool Reorders 🛒',
    html,
  });
}

export default {
  reorders,
};

import fs from 'fs';
import path from 'path';
import axios from 'axios';

async function printLocationLabel(data: { loc: string; pos: string }) {
  const locationLabelXml = fs.readFileSync(
    path.join(process.cwd(), 'public', 'label_location.xml'),
    {
      encoding: 'utf-8',
    },
  );
  const qrCode = `Loc:${data.loc} | ${data.pos}`;
  const label = locationLabelXml.replaceAll('$POSITION', data.pos).replaceAll('$QRCODE', qrCode);
  return print('DYMO LabelWriter Wireless 1', label);
}

async function print(printerName: string, labelXml: string, labelSetXml = '') {
  const hostname = '127.0.0.1';
  const port = 41951;
  const label = `printerName=${encodeURIComponent(printerName)}&printParamsXml=&labelXml=${encodeURIComponent(labelXml)}&labelSetXml=${encodeURIComponent(labelSetXml)}`;
  if (typeof process !== 'undefined' && process.env) process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  return axios.post(`https://${hostname}:${port}/DYMO/DLS/Printing/PrintLabel`, label, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
}

export default {
  printLocationLabel,
};

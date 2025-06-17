import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const hostname = 'thor.bkmachine.lan';
const port = 3005;
const baseUrl = `http://${hostname}:${port}`;
const publicDir = process.env.NODE_ENV === 'production' ? '../../../../public' : '../../public';

const thor = axios.create({
  baseURL: baseUrl,
});

async function printLocationLabel(data: PrintLocationBody) {
  if (!data.loc || !data.pos) throw new Error('Missing location data.');
  const locationLabelXml = fs.readFileSync(path.join(__dirname, publicDir, '/label_location.xml'), {
    encoding: 'utf-8',
  });
  const qrCode = `Loc:${data.loc} | ${data.pos}`;
  const label = locationLabelXml.replaceAll('$POSITION', data.pos).replaceAll('$QRCODE', qrCode);
  const body: PrintRequest = {
    printerName: 'DYMO_LabelWriter_1',
    labelXml: label,
  };
  return thor.post('/print', body);
}

async function printItemLabel(data: PrintItemBody) {
  if (!data.item || !data.description) throw new Error('Missing item data.');
  const itemLabelXml = fs.readFileSync(path.join(__dirname, publicDir, '/label_item.xml'), {
    encoding: 'utf-8',
  });
  const label = itemLabelXml
    .replaceAll('$DESCRIPTION', data.description)
    .replaceAll('$ITEM', data.item)
    .replaceAll('$BRAND', data.brand || '');
  const body: PrintRequest = {
    printerName: 'DYMO_LabelWriter_2',
    labelXml: label,
  };
  return thor.post('/print', body);
}

export default {
  printLocationLabel,
  printItemLabel,
};

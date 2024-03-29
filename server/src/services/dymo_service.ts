import fs from 'fs';
import path from 'path';
import axios from 'axios';

const hostname = 'thor.bkmachine.lan';
const port = 3005;
const baseUrl = `http://${hostname}:${port}`;

const thor = axios.create({
  baseURL: baseUrl,
});

async function printLocationLabel(data: PrintLocationBody) {
  const locationLabelXml = fs.readFileSync(
    path.join(__dirname, '../../public', '/label_location.xml'),
    {
      encoding: 'utf-8',
    },
  );
  const qrCode = `Loc:${data.loc} | ${data.pos}`;
  const label = locationLabelXml.replaceAll('$POSITION', data.pos).replaceAll('$QRCODE', qrCode);
  const body: PrintRequest = {
    printerName: 'DYMO LabelWriter Wireless 1',
    labelXml: label,
  };
  return thor.post('/print', body);
}

export default {
  printLocationLabel,
};

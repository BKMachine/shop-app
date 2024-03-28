import fs from 'fs';
import path from 'path';

async function printLocationLabel(data: { loc: string; pos: string }) {
  const locationLabelXml = fs.readFileSync(
    path.join(__dirname, '../../public', '/label_location.xml'),
    {
      encoding: 'utf-8',
    },
  );
  const qrCode = `Loc:${data.loc} | ${data.pos}`;
  const label = locationLabelXml.replaceAll('$POSITION', data.pos).replaceAll('$QRCODE', qrCode);
  return { printerName: 'DYMO LabelWriter Wireless 1', label };
}

export default {
  printLocationLabel,
};

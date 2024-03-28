import fs from 'fs';
import path from 'path';
import Dymo from 'dymojs';

const dymo = new Dymo();

async function printLocationLabel(data: { loc: string; pos: string }): Promise<boolean> {
  const locationLabelXml = fs.readFileSync(path.join(__dirname, 'label_location.xml'), {
    encoding: 'utf-8',
  });
  const qrCode = `Loc:${data.loc} | ${data.pos}`;
  const label = locationLabelXml.replaceAll('$POSITION', data.pos).replaceAll('$QRCODE', qrCode);
  try {
    dymo.print('DYMO LabelWriter Wireless 1', label);
    return true;
  } catch (e) {
    return false;
  }
}

export default {
  printLocationLabel,
};

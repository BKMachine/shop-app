import fs from 'fs';
import path from 'path';
import Dymo from 'dymojs';
import xml2js from 'xml2js';

const labelXml = fs.readFileSync(path.join(__dirname, 'label.xml'));
const dymo = new Dymo();
const builder = new xml2js.Builder();

async function print(text: string) {
  const parsed = await xml2js.parseStringPromise(labelXml);
  parsed.DesktopLabel.DYMOLabel[0].GrowingDynamicLayoutManager[0].LabelObjects[0].TextObject[0].FormattedText[0].LineTextSpan[0].TextSpan[0].Text[0] =
    text;
  const xmlString = builder.buildObject(parsed);
  dymo.print('DYMO LabelWriter Wireless on DYMOLWW13A740', xmlString);
  return dymo.renderLabel(xmlString);
}

export default print;

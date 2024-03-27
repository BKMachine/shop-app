import fs from 'fs';
import path from 'path';
import Dymo from 'dymojs';
import xml2js from 'xml2js';

const labelXml = fs.readFileSync(path.join(__dirname, 'label_location.xml'));
const dymo = new Dymo();
const builder = new xml2js.Builder();

async function print(data: { loc: string; pos: string }) {
  const parsed = await xml2js.parseStringPromise(labelXml);
  parsed.DesktopLabel.DYMOLabel[0].DynamicLayoutManager[0].LabelObjects[0].TextObject[0].FormattedText[0].LineTextSpan[0].TextSpan[0].Text[0] =
    data.pos;
  const barcode = `Loc:${data.loc} | ${data.pos}`;
  parsed.DesktopLabel.DYMOLabel[0].DynamicLayoutManager[0].LabelObjects[0].QRCodeObject[0].Data[0].DataString[0] =
    barcode;
  parsed.DesktopLabel.DYMOLabel[0].DynamicLayoutManager[0].LabelObjects[0].QRCodeObject[0].TextDataHolder[0].Value[0] =
    barcode;
  const xmlString = builder.buildObject(parsed);
  dymo.print('DYMO Wireless', xmlString);
  return dymo.renderLabel(xmlString);
}

export default print;

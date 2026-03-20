import { PDFParse } from 'pdf-parse';
import { AffiliatedMetalsParser } from './vendors/affiliated_metals_parser.js';
import { GrandisParser } from './vendors/grandis_parser.js';
import { RyersonParser } from './vendors/ryerson_parser.js';

export default async function parseMaterialPdf(data: Buffer): Promise<ParserResults[]> {
  const text = await extractPdfText(data);

  if (text.includes('AFFILIATED METALS')) {
    const results = await AffiliatedMetalsParser(cleanLines(text));
    return results;
  }
  if (text.includes('Ryerson & Son')) {
    const results = await RyersonParser(cleanLines(text));
    return results;
  }
  if (text.includes('Grandis Titanium')) {
    const results = await GrandisParser(cleanLines(text));
    return results;
  }

  return [];
}

export async function extractPdfText(data: Buffer): Promise<string> {
  const parser = new PDFParse({ data });
  const result = await parser.getText();
  await parser.destroy();
  return result.text;
}

export function cleanLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

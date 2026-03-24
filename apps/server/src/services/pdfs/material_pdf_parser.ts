import { PDFParse } from 'pdf-parse';
import { AffiliatedMetalsParser } from './suppliers/affiliated_metals_parser.js';
import { GrandisParser } from './suppliers/grandis_parser.js';
import { RyersonParser } from './suppliers/ryerson_parser.js';

export default async function parseMaterialPdf(data: Buffer): Promise<ParserResults[]> {
  const text = await extractPdfText(data);
  const lines = cleanLines(text);

  if (text.includes('AFFILIATED METALS')) return AffiliatedMetalsParser(lines);
  if (text.includes('Ryerson & Son')) return RyersonParser(lines);
  if (text.includes('Grandis Titanium')) return GrandisParser(lines);

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

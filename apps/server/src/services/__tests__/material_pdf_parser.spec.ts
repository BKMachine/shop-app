import fs from 'node:fs/promises';
import path from 'node:path';
import { AffiliatedMetalsParser, cleanLines, extractPdfText } from '../material_pdf_parser.js';

test('AffiliatedMetalsParser should parse PDF with single flat bar', async () => {
  const file = path.resolve(process.cwd(), 'stubs/Affiliated_Metals/single_flat_bar_lb.pdf');
  const data = await fs.readFile(file);
  const text = await extractPdfText(data);
  const results = await AffiliatedMetalsParser(cleanLines(text));

  expect(results).toEqual([
    {
      costPerFoot: expect.any(Number),
      material: {
        height: 0.5,
        length: 144,
        materialType: '6061',
        type: 'Flat',
        width: 5,
      },
    },
  ]);
});

test('AffiliatedMetalsParser should parse PDF with multiple flat bars', async () => {
  const file = path.resolve(process.cwd(), 'stubs/Affiliated_Metals/multiple_flat_bar_lb.pdf');
  const data = await fs.readFile(file);
  const text = await extractPdfText(data);
  const results = await AffiliatedMetalsParser(cleanLines(text));

  expect(results.length).toBe(2);
  expect(results).toEqual([
    {
      costPerFoot: expect.any(Number),
      material: {
        height: 2.5,
        length: 144,
        materialType: '6061',
        type: 'Flat',
        width: 3.5,
      },
    },
    {
      costPerFoot: expect.any(Number),
      material: {
        height: 1.5,
        length: 144,
        materialType: '6061',
        type: 'Flat',
        width: 1.5,
      },
    },
  ]);
});

test('AffiliatedMetalsParser should parse PDF with round bar lb', async () => {
  const file = path.resolve(process.cwd(), 'stubs/Affiliated_Metals/round_bar_lb.pdf');
  const data = await fs.readFile(file);
  const text = await extractPdfText(data);
  const results = await AffiliatedMetalsParser(cleanLines(text));

  expect(results).toEqual([
    {
      costPerFoot: expect.any(Number),
      material: {
        diameter: 2.5,
        length: 107,
        materialType: '303',
        type: 'Round',
      },
    },
  ]);
});

test('AffiliatedMetalsParser should parse PDF with round tube ft', async () => {
  const file = path.resolve(process.cwd(), 'stubs/Affiliated_Metals/round_tube_ft.pdf');
  const data = await fs.readFile(file);
  const text = await extractPdfText(data);
  const results = await AffiliatedMetalsParser(cleanLines(text));

  expect(results).toEqual([
    {
      costPerFoot: expect.any(Number),
      material: {
        diameter: 0.875,
        length: 240,
        materialType: '304',
        type: 'Round',
        wallThickness: 0.083,
      },
    },
  ]);
});

test('AffiliatedMetalsParser should parse PDF with round pipe ea', async () => {
  const file = path.resolve(process.cwd(), 'stubs/Affiliated_Metals/round_pipe_ea.pdf');
  const data = await fs.readFile(file);
  const text = await extractPdfText(data);
  const results = await AffiliatedMetalsParser(cleanLines(text));

  expect(results).toEqual([
    {
      costPerFoot: expect.any(Number),
      material: {
        diameter: 1.25,
        length: 240,
        materialType: '6061',
        type: 'Round',
        wallThickness: 0.191,
      },
    },
  ]);
});

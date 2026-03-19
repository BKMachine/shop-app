import fs from 'node:fs/promises';
import path from 'node:path';
import { AffiliatedMetalsParser, cleanLines, extractPdfText } from '../material_pdf_parser.js';

test('AffiliatedMetalsParser should parse PDF with single flat bar', async () => {
  const file = path.resolve(process.cwd(), 'stubs/Affiliated_Metals/single_flat_bar_lb.pdf');
  const data = await fs.readFile(file);
  const text = await extractPdfText(data);
  const results = await AffiliatedMetalsParser(cleanLines(text));

  expect(results).toEqual([
    expect.objectContaining({
      costPerFoot: expect.any(Number),
      material: {
        height: 0.5,
        length: 144,
        materialType: '6061',
        type: 'Flat',
        width: 5,
      },
    }),
  ]);
});

test('AffiliatedMetalsParser should parse PDF with multiple flat bars', async () => {
  const file = path.resolve(process.cwd(), 'stubs/Affiliated_Metals/multiple_flat_bar_lb.pdf');
  const data = await fs.readFile(file);
  const text = await extractPdfText(data);
  const results = await AffiliatedMetalsParser(cleanLines(text));

  expect(results.length).toBe(2);
  expect(results).toEqual([
    expect.objectContaining({
      costPerFoot: expect.any(Number),
      material: {
        height: 2.5,
        length: 144,
        materialType: '6061',
        type: 'Flat',
        width: 3.5,
      },
    }),
    expect.objectContaining({
      costPerFoot: expect.any(Number),
      material: {
        height: 1.5,
        length: 144,
        materialType: '6061',
        type: 'Flat',
        width: 1.5,
      },
    }),
  ]);
});

test('AffiliatedMetalsParser should parse PDF with rnd bar lb', async () => {
  const file = path.resolve(process.cwd(), 'stubs/Affiliated_Metals/rnd_bar_lb.pdf');
  const data = await fs.readFile(file);
  const text = await extractPdfText(data);
  const results = await AffiliatedMetalsParser(cleanLines(text));

  expect(results).toEqual([
    expect.objectContaining({
      costPerFoot: expect.any(Number),
      material: {
        diameter: 2.5,
        length: 107,
        materialType: '303',
        type: 'Round',
      },
    }),
  ]);
});

test('AffiliatedMetalsParser should parse PDF with round bar lb', async () => {
  const file = path.resolve(process.cwd(), 'stubs/Affiliated_Metals/round_bar_lb.pdf');
  const data = await fs.readFile(file);
  const text = await extractPdfText(data);
  const results = await AffiliatedMetalsParser(cleanLines(text));

  expect(results).toEqual([
    expect.objectContaining({
      costPerFoot: expect.any(Number),
      material: {
        diameter: 0.625,
        length: 144,
        materialType: '416',
        type: 'Round',
      },
    }),
  ]);
});

test('AffiliatedMetalsParser should parse PDF with round tube ft', async () => {
  const file = path.resolve(process.cwd(), 'stubs/Affiliated_Metals/round_tube_ft.pdf');
  const data = await fs.readFile(file);
  const text = await extractPdfText(data);
  const results = await AffiliatedMetalsParser(cleanLines(text));

  expect(results).toEqual([
    expect.objectContaining({
      costPerFoot: expect.any(Number),
      material: {
        diameter: 0.875,
        length: 240,
        materialType: '304',
        type: 'Round',
        wallThickness: 0.083,
      },
    }),
  ]);
});

test('AffiliatedMetalsParser should parse PDF with round pipe ea', async () => {
  const file = path.resolve(process.cwd(), 'stubs/Affiliated_Metals/round_pipe_ea.pdf');
  const data = await fs.readFile(file);
  const text = await extractPdfText(data);
  const results = await AffiliatedMetalsParser(cleanLines(text));

  expect(results).toEqual([
    expect.objectContaining({
      costPerFoot: expect.any(Number),
      material: {
        diameter: 1.25,
        length: 240,
        materialType: '6061',
        type: 'Round',
        wallThickness: 0.191,
      },
    }),
  ]);
});

test('AffiliatedMetalsParser should parse PDF with round pipe with notes', async () => {
  const file = path.resolve(process.cwd(), 'stubs/Affiliated_Metals/round_pipe_with_notes.pdf');
  const data = await fs.readFile(file);
  const text = await extractPdfText(data);
  const results = await AffiliatedMetalsParser(cleanLines(text));

  expect(results).toEqual([
    expect.objectContaining({
      costPerFoot: expect.any(Number),
      material: {
        diameter: 1.25,
        length: 240,
        materialType: '304',
        type: 'Round',
        wallThickness: 0.191,
      },
    }),
  ]);
});

test('AffiliatedMetalsParser should override pipe dimensions from ACTUAL DIMENTIONS line', async () => {
  const file = path.resolve(
    process.cwd(),
    'stubs/Affiliated_Metals/round_pipe_with_actual_dims.pdf',
  );
  const data = await fs.readFile(file);
  const text = await extractPdfText(data);
  const results = await AffiliatedMetalsParser(cleanLines(text));

  expect(results).toEqual([
    expect.objectContaining({
      material: {
        diameter: 0.84,
        length: 240,
        materialType: '304',
        type: 'Round',
        wallThickness: 0.083,
      },
    }),
  ]);

  expect(results[0]?.lineContext.sizesHighlights).toEqual([
    { text: '240.0000"', label: 'dimension' },
  ]);
  expect(results[0]?.lineContext.override).toMatch(
    /^ACTUAL D(?:IMENSIONS|IMENTIONS): \.84" OD X \.083 WALL$/,
  );
  expect(results[0]?.lineContext.overrideHighlights).toEqual([
    { text: '.84"', label: 'dimension' },
    { text: '.083', label: 'dimension' },
  ]);
});

/// <reference types="jest" />

import fs from 'node:fs/promises';
import path from 'node:path';
import { cleanLines, extractPdfText } from '../material_pdf_parser.js';
import { extractPdfDate } from '../parser_utils.js';
import {
  AffiliatedMetalsParser,
  extractAffiliatedTopLeftDate,
} from '../suppliers/affiliated_metals_parser.js';
import { GrandisParser } from '../suppliers/grandis_parser.js';
import { extractRyersonEnteredDate, RyersonParser } from '../suppliers/ryerson_parser.js';

const grandisTextFixturePath = path.resolve(
  process.cwd(),
  'stubs/Grandis/grandis_extracted.pdf.txt',
);
const ryersonTextFixturePath = path.resolve(
  process.cwd(),
  'stubs/Ryerson/ryerson_extracted.pdf.txt',
);

async function readTextFixture(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf8');
}

async function parseMaterialPdfFromText(text: string) {
  jest.resetModules();
  jest.doMock('pdf-parse', () => ({
    PDFParse: class {
      async getText(): Promise<{ text: string }> {
        return { text };
      }

      async destroy(): Promise<void> {}
    },
  }));

  try {
    const module = await import('../material_pdf_parser.js');
    return module.default(Buffer.from('fixture'));
  } finally {
    jest.dontMock('pdf-parse');
    jest.resetModules();
  }
}

test('AffiliatedMetalsParser should parse PDF with single flat bar', async () => {
  const file = path.resolve(process.cwd(), 'stubs/Affiliated_Metals/single_flat_bar_lb.pdf');
  const data = await fs.readFile(file);
  const text = await extractPdfText(data);
  const results = await AffiliatedMetalsParser(cleanLines(text));

  expect(results).toEqual([
    expect.objectContaining({
      costPerFoot: expect.any(Number),
      material: expect.objectContaining({
        height: 0.5,
        length: 144,
        materialType: '6061',
        supplier: '65d97c59a6e990cf2a330061',
        type: 'Flat',
        width: 5,
      }),
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
      material: expect.objectContaining({
        height: 2.5,
        length: 144,
        materialType: '6061',
        supplier: '65d97c59a6e990cf2a330061',
        type: 'Flat',
        width: 3.5,
      }),
    }),
    expect.objectContaining({
      costPerFoot: expect.any(Number),
      material: expect.objectContaining({
        height: 1.5,
        length: 144,
        materialType: '6061',
        supplier: '65d97c59a6e990cf2a330061',
        type: 'Flat',
        width: 1.5,
      }),
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
      material: expect.objectContaining({
        diameter: 2.5,
        length: 107,
        materialType: '303',
        supplier: '65d97c59a6e990cf2a330061',
        type: 'Round',
      }),
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
      material: expect.objectContaining({
        diameter: 0.625,
        length: 144,
        materialType: '416',
        supplier: '65d97c59a6e990cf2a330061',
        type: 'Round',
      }),
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
      material: expect.objectContaining({
        diameter: 0.875,
        length: 240,
        materialType: '304',
        supplier: '65d97c59a6e990cf2a330061',
        type: 'Round',
        wallThickness: 0.083,
      }),
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
      material: expect.objectContaining({
        diameter: 1.25,
        length: 240,
        materialType: '6061',
        supplier: '65d97c59a6e990cf2a330061',
        type: 'Round',
        wallThickness: 0.191,
      }),
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
      material: expect.objectContaining({
        diameter: 1.25,
        length: 240,
        materialType: '304',
        supplier: '65d97c59a6e990cf2a330061',
        type: 'Round',
        wallThickness: 0.191,
      }),
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
      material: expect.objectContaining({
        diameter: 0.84,
        length: 240,
        materialType: '304',
        supplier: '65d97c59a6e990cf2a330061',
        type: 'Round',
        wallThickness: 0.083,
      }),
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

test('RyersonParser should parse ryerson order with decimal pricing units', async () => {
  const text = await readTextFixture(ryersonTextFixturePath);
  const results = await RyersonParser(cleanLines(text));

  expect(results).toHaveLength(3);
  expect(results[0]).toEqual(
    expect.objectContaining({
      unitType: 'lb',
      rate: 3.2,
      material: expect.objectContaining({
        diameter: 1,
        length: 144,
        materialType: '304',
        supplier: '6819152ea42bd260e8e9340c',
        type: 'Round',
      }),
      costPerFoot: expect.any(Number),
    }),
  );

  expect(results[1]).toEqual(
    expect.objectContaining({
      unitType: 'lb',
      rate: 3.2,
      material: expect.objectContaining({
        diameter: 1.25,
        length: 144,
        materialType: '304',
        supplier: '6819152ea42bd260e8e9340c',
        type: 'Round',
      }),
    }),
  );

  expect(results[2]).toEqual(
    expect.objectContaining({
      unitType: 'ft',
      rate: 3.85,
      material: expect.objectContaining({
        diameter: 1.375,
        length: 264,
        materialType: '1020',
        supplier: '6819152ea42bd260e8e9340c',
        type: 'Round',
        wallThickness: 0.095,
      }),
      costPerFoot: 3.85,
    }),
  );

  expect(results[0]?.lineContext.headerHighlights).toEqual(
    expect.arrayContaining([
      { text: '304', label: 'materialType' },
      { text: 'RD', label: 'type' },
    ]),
  );

  expect(results[2]?.lineContext.headerHighlights).toEqual(
    expect.arrayContaining([
      { text: '1020', label: 'materialType' },
      { text: 'Tube', label: 'type' },
      { text: 'RD', label: 'type' },
    ]),
  );

  expect(results[2]?.lineContext.override).toBe('GAUGE CONVERSION: 13GA W -> 0.095 WALL');
  expect(results[2]?.lineContext.overrideHighlights).toEqual([
    { text: '13GA', label: 'dimension' },
    { text: '0.095', label: 'dimension' },
  ]);

  expect(results[2]?.lineContext.amounts).toBe(results[2]?.lineContext.header);
  expect(results[2]?.lineContext.amountsHighlights).toEqual([
    { text: '$3.8500 FT', label: 'rate' },
  ]);
});

test('RyersonParser should parse line items with comma-separated weights', async () => {
  const text = cleanLines(`
Joseph T. Ryerson & Son, Inc.
10 6 PC Stnls Bar RD CF 303 Ann 1,084.320 1,084.3200 $2.9200 LB
2.375in X 144in RL
160008265 Extended Amount $3,166.21
Pieces: 6 P/N Delivery Date 02/26/2026
  `);

  const results = await RyersonParser(text);

  expect(results).toHaveLength(1);
  expect(results[0]).toEqual(
    expect.objectContaining({
      unitType: 'lb',
      rate: 2.92,
      material: expect.objectContaining({
        diameter: 2.375,
        length: 144,
        materialType: '303',
        supplier: '6819152ea42bd260e8e9340c',
        type: 'Round',
      }),
      costPerFoot: expect.any(Number),
    }),
  );
  expect(results[0]?.lineContext.amountsHighlights).toEqual([
    { text: '$2.9200 LB', label: 'rate' },
  ]);
});

test('RyersonParser should parse flat bar rows priced per piece', async () => {
  const text = cleanLines(`
Joseph T. Ryerson & Son, Inc.
10 7 PC CARB Bar FLT CF 1018 499.800 7.0000 $117.8100 PC
1in X 1.75in X 144in RL
160002897 Extended Amount $824.67
Pieces: 7 P/N Delivery Date 02/12/2026
  `);

  const results = await RyersonParser(text);

  expect(results).toHaveLength(1);
  expect(results[0]).toEqual(
    expect.objectContaining({
      unitType: 'ea',
      rate: 117.81,
      material: expect.objectContaining({
        height: 1,
        width: 1.75,
        length: 144,
        materialType: '1018',
        supplier: '6819152ea42bd260e8e9340c',
        type: 'Flat',
      }),
      costPerFoot: 9.8175,
    }),
  );
  expect(results[0]?.lineContext.headerHighlights).toEqual(
    expect.arrayContaining([
      { text: '1018', label: 'materialType' },
      { text: 'FLT', label: 'type' },
    ]),
  );
  expect(results[0]?.lineContext.amountsHighlights).toEqual([
    { text: '$117.8100 PC', label: 'rate' },
  ]);
});

test('GrandisParser should parse 6AL-4V invoice rows and key Round from Dia', async () => {
  const text = await readTextFixture(grandisTextFixturePath);
  const results = await GrandisParser(cleanLines(text));

  expect(results).toHaveLength(2);
  expect(results[0]).toEqual(
    expect.objectContaining({
      unitType: 'lb',
      rate: 21.75,
      material: expect.objectContaining({
        materialType: '6Al-4V',
        type: 'Round',
        isMetric: false,
        diameter: 1,
        length: 144,
        supplier: '69c2d236b0d4b0faf02ef132',
      }),
    }),
  );

  expect(results[0]?.lineContext.headerHighlights).toEqual(
    expect.arrayContaining([{ text: '6Al-4V', label: 'materialType' }]),
  );

  expect(results[0]?.lineContext.sizesHighlights).toEqual(
    expect.arrayContaining([
      { text: 'Dia', label: 'type' },
      { text: '1.0"', label: 'dimension' },
    ]),
  );
});

test('GrandisParser should accept mm diameters and normalize to inches', async () => {
  const text = cleanLines(`
    Invoice
    Date
    4/7/2025
    Grandis Titanium LLC
    Item Description Quantity, KG Price Each Amount, USD
    Ti 6-4 Bars GT#REDACTED-3 Titanium 6Al-4V Bars
    Dia 25.4mm x R/L - 10 pcs
    Net 176 lbs x $21.75/lb
  `);

  const results = await GrandisParser(text);

  expect(results).toHaveLength(1);
  expect(results[0]).toEqual(
    expect.objectContaining({
      unitType: 'lb',
      rate: 21.75,
      material: expect.objectContaining({
        materialType: '6Al-4V',
        type: 'Round',
        isMetric: true,
        diameter: 1,
        length: 144,
        supplier: '69c2d236b0d4b0faf02ef132',
      }),
    }),
  );

  expect(results[0]?.lineContext.sizesHighlights).toEqual(
    expect.arrayContaining([
      { text: 'Dia', label: 'type' },
      { text: '25.4mm', label: 'dimension' },
    ]),
  );
});

test('GrandisParser should accept Ti 6-4 shorthand headers with mm diameters', async () => {
  const text = cleanLines(`
    Invoice
    Date
    4/7/2025
    Grandis Titanium LLC
    Item Description Quantity, KG Price Each Amount, USD
    Ti 6-4 Bars GT#REDACTED-4
    Dia 25.4mm x R/L - 10 pcs
    Net 176 lbs x $21.75/lb
  `);

  const results = await GrandisParser(text);

  expect(results).toHaveLength(1);
  expect(results[0]).toEqual(
    expect.objectContaining({
      material: expect.objectContaining({
        materialType: '6Al-4V',
        type: 'Round',
        isMetric: true,
        diameter: 1,
      }),
    }),
  );

  expect(results[0]?.lineContext.headerHighlights).toEqual(
    expect.arrayContaining([{ text: 'Ti 6-4', label: 'materialType' }]),
  );
});

test('GrandisParser should map Titanium 6-7 headers to 6Al-7Nb', async () => {
  const text = cleanLines(`
    Invoice
    Date
    4/7/2025
    Grandis Titanium LLC
    Item Description Quantity, KG Price Each Amount, USD
    Titanium 6-7 Bars GT#REDACTED-5
    Dia 12 mm x R/L - 27 pcs
    Net 91 lbs x $12.50/lb
  `);

  const results = await GrandisParser(text);

  expect(results).toHaveLength(1);
  expect(results[0]).toEqual(
    expect.objectContaining({
      unitType: 'lb',
      rate: 12.5,
      material: expect.objectContaining({
        materialType: '6Al-7Nb',
        type: 'Round',
        isMetric: true,
        diameter: 12 / 25.4,
      }),
    }),
  );

  expect(results[0]?.lineContext.sizesHighlights).toEqual(
    expect.arrayContaining([
      { text: 'Dia', label: 'type' },
      { text: '12 mm', label: 'dimension' },
    ]),
  );

  expect(results[0]?.lineContext.headerHighlights).toEqual(
    expect.arrayContaining([{ text: 'Titanium 6-7', label: 'materialType' }]),
  );
});

test('parseMaterialPdf should route Grandis invoices', async () => {
  const text = await readTextFixture(grandisTextFixturePath);
  const results = await parseMaterialPdfFromText(text);

  expect(results.length).toBeGreaterThan(0);
  expect(results[0]?.material.materialType).toBe('6Al-4V');
  expect(results[0]?.material.supplier).toBe('69c2d236b0d4b0faf02ef132');
});

test('extractPdfDate should parse Affiliated compact date format', async () => {
  const file = path.resolve(process.cwd(), 'stubs/Affiliated_Metals/single_flat_bar_lb.pdf');
  const data = await fs.readFile(file);
  const text = await extractPdfText(data);
  const extracted = extractPdfDate(cleanLines(text));

  expect(extracted).not.toBeNull();
  expect(extracted?.date.getFullYear()).toBe(2026);
  expect(extracted?.date.getMonth()).toBe(1);
  expect(extracted?.date.getDate()).toBe(24);
});

test('extractAffiliatedTopLeftDate should read Ord date from Trm line', () => {
  const lines = cleanLines(`
24Feb26 10:35 SALES ACKNOWLEDGMENT
Trm ***** C.O.D. ***** Ord 24Feb26 Due25Feb26
EFFECTIVE 3/1/2024, ALL CREDIT CARD TRANSACTIONS
  `);

  const extracted = extractAffiliatedTopLeftDate(lines);

  expect(extracted).not.toBeNull();
  expect(extracted?.date.getFullYear()).toBe(2026);
  expect(extracted?.date.getMonth()).toBe(1);
  expect(extracted?.date.getDate()).toBe(24);
  expect(extracted?.token).toBe('24Feb26');
});

test('extractAffiliatedTopLeftDate should not be fooled by footer slash dates', () => {
  const lines = cleanLines(`
24Feb26 10:35 SALES ACKNOWLEDGMENT
Trm ***** C.O.D. ***** Ord 15Mar26 Due16Mar26
EFFECTIVE 3/1/2024, ALL CREDIT CARD TRANSACTIONS
  `);

  const extracted = extractAffiliatedTopLeftDate(lines);

  expect(extracted?.date.getFullYear()).toBe(2026);
  expect(extracted?.date.getMonth()).toBe(2); // March
  expect(extracted?.date.getDate()).toBe(15);
});

test('parseMaterialPdf should include createdAt from Ryerson Entered date', async () => {
  const text = await readTextFixture(ryersonTextFixturePath);
  const results = await parseMaterialPdfFromText(text);

  expect(results.length).toBeGreaterThan(0);
  expect(results[0]?.createdAt).toBeInstanceOf(Date);
  expect(results[0]?.material.supplier).toBe('6819152ea42bd260e8e9340c');
  expect(results[0]?.createdAt.getFullYear()).toBe(2026);
  expect(results[0]?.createdAt.getMonth()).toBe(2);
  expect(results[0]?.createdAt.getDate()).toBe(12);
});

test('extractRyersonEnteredDate should parse Entered: date line', () => {
  const lines = cleanLines(`
Joseph T. Ryerson & Son, Inc.
Printed: 03/12/2026
Entered:03/12/2026
  `);

  const extracted = extractRyersonEnteredDate(lines);

  expect(extracted).not.toBeNull();
  expect(extracted?.token).toBe('03/12/2026');
  expect(extracted?.date.getFullYear()).toBe(2026);
  expect(extracted?.date.getMonth()).toBe(2);
  expect(extracted?.date.getDate()).toBe(12);
});

test('extractRyersonEnteredDate should prefer Entered over Printed', () => {
  const lines = cleanLines(`
Printed: 01/01/2025
Entered:03/12/2026
  `);

  const extracted = extractRyersonEnteredDate(lines);

  expect(extracted?.date.getFullYear()).toBe(2026);
  expect(extracted?.date.getDate()).toBe(12);
});

import fs from 'node:fs/promises';
import path from 'node:path';
import parseMaterialPdf, {
  cleanLines,
  extractAffiliatedTopLeftDate,
  extractPdfDate,
  extractPdfText,
  extractRyersonEnteredDate,
} from '../material_pdf_parser.js';
import { AffiliatedMetalsParser } from '../vendors/affiliated_metals_parser.js';
import { GrandisParser } from '../vendors/grandis_parser.js';
import { RyersonParser } from '../vendors/ryerson_parser.js';

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

test('RyersonParser should parse ryerson order with decimal pricing units', async () => {
  const file = path.resolve(
    process.cwd(),
    'stubs/Ryerson/Order#18587819-PO#Jeff 3122026-BK MACHINE INC.pdf',
  );
  const data = await fs.readFile(file);
  const text = await extractPdfText(data);
  const results = await RyersonParser(cleanLines(text));

  expect(results).toHaveLength(3);
  expect(results[0]).toEqual(
    expect.objectContaining({
      unitType: 'lb',
      rate: 3.2,
      material: {
        diameter: 1,
        length: 144,
        materialType: '304',
        type: 'Round',
      },
      costPerFoot: expect.any(Number),
    }),
  );

  expect(results[1]).toEqual(
    expect.objectContaining({
      unitType: 'lb',
      rate: 3.2,
      material: {
        diameter: 1.25,
        length: 144,
        materialType: '304',
        type: 'Round',
      },
    }),
  );

  expect(results[2]).toEqual(
    expect.objectContaining({
      unitType: 'ft',
      rate: 3.85,
      material: {
        diameter: 1.375,
        length: 264,
        materialType: '1020',
        type: 'Round',
        wallThickness: 0.095,
      },
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
      material: {
        diameter: 2.375,
        length: 144,
        materialType: '303',
        type: 'Round',
      },
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
      material: {
        height: 1,
        width: 1.75,
        length: 144,
        materialType: '1018',
        type: 'Flat',
      },
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
  const file = path.resolve(
    process.cwd(),
    'stubs/Grandis/Inv_8764167918_from_Grandis_Titanium_LLC_26648.pdf',
  );
  const data = await fs.readFile(file);
  const text = await extractPdfText(data);
  const results = await GrandisParser(cleanLines(text));

  expect(results).toHaveLength(2);
  expect(results[0]).toEqual(
    expect.objectContaining({
      unitType: 'lb',
      rate: 21.75,
      material: expect.objectContaining({
        materialType: '6Al-4V',
        type: 'Round',
        diameter: 1,
        length: 144,
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

test('parseMaterialPdf should route Grandis invoices', async () => {
  const file = path.resolve(
    process.cwd(),
    'stubs/Grandis/Inv_8764167918_from_Grandis_Titanium_LLC_26648.pdf',
  );
  const data = await fs.readFile(file);
  const results = await parseMaterialPdf(data);

  expect(results.length).toBeGreaterThan(0);
  expect(results[0]?.material.materialType).toBe('6Al-4V');
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
  const file = path.resolve(
    process.cwd(),
    'stubs/Ryerson/Order#18587819-PO#Jeff 3122026-BK MACHINE INC.pdf',
  );
  const data = await fs.readFile(file);
  const results = await parseMaterialPdf(data);

  expect(results.length).toBeGreaterThan(0);
  expect(results[0]?.createdAt).toBeInstanceOf(Date);
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

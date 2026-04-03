import fs from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { PDFParse } from 'pdf-parse';

interface CliOptions {
  targets: string[];
  outputDir: string | null;
  inPlace: boolean;
  overwrite: boolean;
  format: 'txt' | 'ts' | 'pdf';
}

const TEXT_FONT_SIZE = 9;
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const PAGE_MARGIN = 36;
const LINE_HEIGHT = 12;

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const inputFiles = await collectPdfFiles(options.targets);

  if (!inputFiles.length) {
    throw new Error('No PDF files found for the provided path(s).');
  }

  for (const inputFile of inputFiles) {
    const outputFile = buildOutputPath(inputFile, options);
    if (!options.overwrite && inputFile === outputFile) {
      throw new Error(`Refusing to overwrite ${inputFile} without --overwrite.`);
    }

    if (!options.overwrite && (await pathExists(outputFile))) {
      throw new Error(`Refusing to overwrite existing output ${outputFile} without --overwrite.`);
    }

    const extractedText = await extractPdfText(inputFile);
    await writeOutputFile(outputFile, extractedText, options.format);
    console.log(
      `${path.relative(process.cwd(), inputFile)} -> ${path.relative(process.cwd(), outputFile)}`,
    );
  }
}

function parseArgs(args: string[]): CliOptions {
  const targets: string[] = [];
  let outputDir: string | null = null;
  let inPlace = false;
  let overwrite = false;
  let format: 'txt' | 'ts' | 'pdf' = 'txt';

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg) continue;

    if (arg === '--output-dir') {
      const value = args[index + 1];
      if (!value) throw new Error('Missing value for --output-dir');
      outputDir = path.resolve(value);
      index += 1;
      continue;
    }

    if (arg === '--in-place') {
      inPlace = true;
      continue;
    }

    if (arg === '--overwrite') {
      overwrite = true;
      continue;
    }

    if (arg === '--format') {
      const value = args[index + 1];
      if (!value || !isSupportedFormat(value)) {
        throw new Error('Missing or invalid value for --format. Use txt, ts, or pdf.');
      }
      format = value;
      index += 1;
      continue;
    }

    if (arg === '--help') {
      printHelp();
      process.exit(0);
    }

    targets.push(path.resolve(arg));
  }

  if (!targets.length) {
    throw new Error('Provide at least one PDF file or directory.');
  }

  if (inPlace && outputDir) {
    throw new Error('Use either --in-place or --output-dir, not both.');
  }

  return { targets, outputDir, inPlace, overwrite, format };
}

function printHelp(): void {
  console.log(
    `Usage: pnpm fixture:pdf-text -- [paths...] [--format txt|ts|pdf] [--in-place] [--overwrite] [--output-dir dir]\n\nExtracts text from each source PDF. By default, writes a sibling .text.txt file and preserves the source PDF.`,
  );
}

async function collectPdfFiles(targets: string[]): Promise<string[]> {
  const files = new Set<string>();

  for (const target of targets) {
    const stat = await fs.stat(target);
    if (stat.isDirectory()) {
      await walkDirectory(target, files);
      continue;
    }

    if (isPdfPath(target)) files.add(target);
  }

  return [...files].sort((left, right) => left.localeCompare(right));
}

async function walkDirectory(dir: string, files: Set<string>): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkDirectory(entryPath, files);
      continue;
    }

    if (entry.isFile() && isPdfPath(entry.name)) {
      files.add(entryPath);
    }
  }
}

function isPdfPath(value: string): boolean {
  return value.toLowerCase().endsWith('.pdf');
}

function buildOutputPath(inputFile: string, options: CliOptions): string {
  if (options.inPlace) return inputFile;

  const outputName = buildOutputName(inputFile, options.format);
  if (!options.outputDir) {
    return path.join(path.dirname(inputFile), outputName);
  }

  return path.join(options.outputDir, outputName);
}

function buildOutputName(inputFile: string, format: CliOptions['format']): string {
  const baseName = path.basename(inputFile, '.pdf');
  if (format === 'pdf') return `${baseName}.text.pdf`;
  if (format === 'ts') return `${baseName}.text.ts`;
  return `${baseName}.text.txt`;
}

function isSupportedFormat(value: string): value is CliOptions['format'] {
  return value === 'txt' || value === 'ts' || value === 'pdf';
}

async function extractPdfText(filePath: string): Promise<string> {
  const data = await fs.readFile(filePath);
  const parser = new PDFParse({ data: new Uint8Array(data) });

  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

async function writeOutputFile(
  filePath: string,
  text: string,
  format: CliOptions['format'],
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  if (format === 'pdf') {
    await writeTextPdf(filePath, text);
    return;
  }

  if (format === 'ts') {
    await fs.writeFile(filePath, buildTsModule(text), 'utf8');
    return;
  }

  await fs.writeFile(filePath, text, 'utf8');
}

async function writeTextPdf(filePath: string, text: string): Promise<void> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Courier);
  const lines = text.split('\n');
  const maxLinesPerPage = Math.floor((PAGE_HEIGHT - PAGE_MARGIN * 2) / LINE_HEIGHT);

  for (let index = 0; index < lines.length; index += maxLinesPerPage) {
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const chunk = lines.slice(index, index + maxLinesPerPage);

    chunk.forEach((line, lineIndex) => {
      page.drawText(line, {
        x: PAGE_MARGIN,
        y: PAGE_HEIGHT - PAGE_MARGIN - lineIndex * LINE_HEIGHT,
        size: TEXT_FONT_SIZE,
        font,
      });
    });
  }

  if (!lines.length) {
    pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  }

  const bytes = await pdf.save();
  await fs.writeFile(filePath, bytes);
}

function buildTsModule(text: string): string {
  return `const extractedPdfText = ${JSON.stringify(text)};\n\nexport default extractedPdfText;\n`;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

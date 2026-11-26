import logger from '../logger.js';

/**
 * Minimal IPP/2.0 client for sending a PDF straight to a network printer
 * (Print-Job to ipp://<hostname>/ipp/print over port 631). Both shop printers,
 * the Sharp MX-3051 and Brother HL-L3220CDW, accept application/pdf.
 */

const IPP_PORT = 631;
const IPP_PATH = '/ipp/print';
const PRINT_TIMEOUT_MS = 30_000;

const OPERATION_PRINT_JOB = 0x0002;

const TAG = {
  operationAttributes: 0x01,
  jobAttributes: 0x02,
  endOfAttributes: 0x03,
  integer: 0x21,
  enum: 0x23,
  textWithoutLanguage: 0x41,
  nameWithoutLanguage: 0x42,
  keyword: 0x44,
  uri: 0x45,
  charset: 0x47,
  naturalLanguage: 0x48,
  mimeMediaType: 0x49,
} as const;

export class IppError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'IppError';
  }
}

export type IppPrintOptions = {
  jobName: string;
  userName?: string;
  /** e.g. na_letter_8.5x11in */
  media?: string;
};

export type IppPrintResult = {
  statusCode: number;
  jobId: number | null;
};

function encodeAttribute(tag: number, name: string, value: string | number): Buffer {
  const nameBytes = Buffer.from(name, 'utf8');
  let valueBytes: Buffer;
  if (typeof value === 'number') {
    valueBytes = Buffer.alloc(4);
    valueBytes.writeInt32BE(value, 0);
  } else {
    valueBytes = Buffer.from(value, 'utf8');
  }

  const out = Buffer.alloc(1 + 2 + nameBytes.length + 2 + valueBytes.length);
  let offset = out.writeUInt8(tag, 0);
  offset = out.writeUInt16BE(nameBytes.length, offset);
  offset += nameBytes.copy(out, offset);
  offset = out.writeUInt16BE(valueBytes.length, offset);
  valueBytes.copy(out, offset);
  return out;
}

export function printerUri(hostname: string) {
  return `ipp://${hostname}${IPP_PATH}`;
}

/** Builds a Print-Job request: IPP header, attributes, then the PDF bytes. */
export function buildPrintJobRequest(
  hostname: string,
  pdf: Uint8Array,
  options: IppPrintOptions,
  requestId = 1,
): Buffer {
  const header = Buffer.alloc(8);
  header.writeUInt8(2, 0); // version 2.0
  header.writeUInt8(0, 1);
  header.writeUInt16BE(OPERATION_PRINT_JOB, 2);
  header.writeUInt32BE(requestId, 4);

  return Buffer.concat([
    header,
    Buffer.from([TAG.operationAttributes]),
    encodeAttribute(TAG.charset, 'attributes-charset', 'utf-8'),
    encodeAttribute(TAG.naturalLanguage, 'attributes-natural-language', 'en'),
    encodeAttribute(TAG.uri, 'printer-uri', printerUri(hostname)),
    encodeAttribute(
      TAG.nameWithoutLanguage,
      'requesting-user-name',
      options.userName || 'shop-app',
    ),
    encodeAttribute(TAG.nameWithoutLanguage, 'job-name', options.jobName.slice(0, 255)),
    encodeAttribute(TAG.mimeMediaType, 'document-format', 'application/pdf'),
    Buffer.from([TAG.jobAttributes]),
    encodeAttribute(TAG.keyword, 'media', options.media || 'na_letter_8.5x11in'),
    encodeAttribute(TAG.keyword, 'sides', 'one-sided'),
    // The PDF is already laid out for the page; let the printer shrink it into its printable area.
    encodeAttribute(TAG.keyword, 'print-scaling', 'fit'),
    Buffer.from([TAG.endOfAttributes]),
    Buffer.from(pdf),
  ]);
}

type ParsedResponse = {
  statusCode: number;
  attributes: Map<string, string | number>;
};

/** Reads the status code and first value of each attribute from an IPP response. */
export function parseIppResponse(buffer: Buffer): ParsedResponse {
  if (buffer.length < 8) throw new IppError('Printer sent a truncated IPP response.');

  const statusCode = buffer.readUInt16BE(2);
  const attributes = new Map<string, string | number>();
  let offset = 8;

  while (offset < buffer.length) {
    const tag = buffer.readUInt8(offset++);
    if (tag === TAG.endOfAttributes) break;
    if (tag < 0x10) continue; // group delimiter
    if (offset + 2 > buffer.length) break;

    const nameLength = buffer.readUInt16BE(offset);
    offset += 2;
    const name = buffer.toString('utf8', offset, offset + nameLength);
    offset += nameLength;
    const valueLength = buffer.readUInt16BE(offset);
    offset += 2;
    const raw = buffer.subarray(offset, offset + valueLength);
    offset += valueLength;

    // An empty name is an additional value of the previous attribute; keep the first.
    if (!name || attributes.has(name)) continue;
    const isInteger = (tag === TAG.integer || tag === TAG.enum) && valueLength === 4;
    attributes.set(name, isInteger ? raw.readInt32BE(0) : raw.toString('utf8'));
  }

  return { statusCode, attributes };
}

/** Sends a PDF to ipp://<hostname>/ipp/print and resolves once the printer accepts the job. */
export async function printPdf(
  hostname: string,
  pdf: Uint8Array,
  options: IppPrintOptions,
): Promise<IppPrintResult> {
  const body = buildPrintJobRequest(hostname, pdf, options);
  const url = `http://${hostname}:${IPP_PORT}${IPP_PATH}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/ipp' },
      body: new Uint8Array(body),
      signal: AbortSignal.timeout(PRINT_TIMEOUT_MS),
    });
  } catch (error) {
    const reason = error instanceof Error ? (error.cause as Error)?.message || error.message : '';
    throw new IppError(`Could not reach printer ${hostname}${reason ? `: ${reason}` : ''}`);
  }

  if (!response.ok) {
    throw new IppError(`Printer ${hostname} answered HTTP ${response.status}.`);
  }

  const { statusCode, attributes } = parseIppResponse(Buffer.from(await response.arrayBuffer()));
  // 0x0000-0x00ff are the IPP "successful" status codes.
  if (statusCode > 0x00ff) {
    const message = attributes.get('status-message');
    throw new IppError(
      `Printer ${hostname} rejected the job (IPP status 0x${statusCode.toString(16).padStart(4, '0')}${message ? `: ${message}` : ''}).`,
      statusCode,
    );
  }

  const jobId = attributes.get('job-id');
  logger.info(
    `IPP job "${options.jobName}" accepted by ${hostname}${typeof jobId === 'number' ? ` as job ${jobId}` : ''}`,
  );
  return { statusCode, jobId: typeof jobId === 'number' ? jobId : null };
}

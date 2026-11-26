import { buildPrintJobRequest, parseIppResponse, printerUri } from '../ipp_service.js';

function attribute(tag: number, name: string, value: Buffer) {
  const nameBytes = Buffer.from(name);
  const out = Buffer.alloc(5 + nameBytes.length + value.length);
  let offset = out.writeUInt8(tag, 0);
  offset = out.writeUInt16BE(nameBytes.length, offset);
  offset += nameBytes.copy(out, offset);
  offset = out.writeUInt16BE(value.length, offset);
  value.copy(out, offset);
  return out;
}

function int32(value: number) {
  const out = Buffer.alloc(4);
  out.writeInt32BE(value, 0);
  return out;
}

describe('buildPrintJobRequest', () => {
  const pdf = Buffer.from('%PDF-1.7 test');
  const request = buildPrintJobRequest('sharp.bkmachine.lan', pdf, { jobName: 'Photo' }, 7);

  it('writes an IPP 2.0 Print-Job header', () => {
    expect(request.readUInt8(0)).toBe(2);
    expect(request.readUInt8(1)).toBe(0);
    expect(request.readUInt16BE(2)).toBe(0x0002);
    expect(request.readUInt32BE(4)).toBe(7);
  });

  it('starts with charset and language, then names the printer and PDF format', () => {
    const { attributes } = parseIppResponse(request);
    expect([...attributes.keys()].slice(0, 3)).toEqual([
      'attributes-charset',
      'attributes-natural-language',
      'printer-uri',
    ]);
    expect(attributes.get('printer-uri')).toBe('ipp://sharp.bkmachine.lan/ipp/print');
    expect(attributes.get('document-format')).toBe('application/pdf');
    expect(attributes.get('job-name')).toBe('Photo');
    expect(attributes.get('requesting-user-name')).toBe('shop-app');
    expect(attributes.get('media')).toBe('na_letter_8.5x11in');
    expect(attributes.get('print-scaling')).toBe('fit');
  });

  it('puts the document after the end-of-attributes tag', () => {
    const endIndex = request.length - pdf.length - 1;
    expect(request.readUInt8(endIndex)).toBe(0x03);
    expect(request.subarray(endIndex + 1).equals(pdf)).toBe(true);
  });

  it('builds the printer URI from the hostname', () => {
    expect(printerUri('brother.bkmachine.lan')).toBe('ipp://brother.bkmachine.lan/ipp/print');
  });
});

describe('parseIppResponse', () => {
  it('reads the status code, job id and status message', () => {
    const response = Buffer.concat([
      Buffer.from([2, 0, 0x04, 0x00, 0, 0, 0, 1]),
      Buffer.from([0x01]),
      attribute(0x47, 'attributes-charset', Buffer.from('utf-8')),
      attribute(0x41, 'status-message', Buffer.from('client-error-bad-request')),
      Buffer.from([0x02]),
      attribute(0x21, 'job-id', int32(42)),
      attribute(0x23, 'job-state', int32(3)),
      Buffer.from([0x03]),
    ]);

    const { statusCode, attributes } = parseIppResponse(response);
    expect(statusCode).toBe(0x0400);
    expect(attributes.get('status-message')).toBe('client-error-bad-request');
    expect(attributes.get('job-id')).toBe(42);
    expect(attributes.get('job-state')).toBe(3);
  });

  it('keeps the first value of a multi-valued attribute', () => {
    const response = Buffer.concat([
      Buffer.from([2, 0, 0, 0, 0, 0, 0, 1, 0x04]),
      attribute(0x49, 'document-format-supported', Buffer.from('application/pdf')),
      attribute(0x49, '', Buffer.from('image/jpeg')),
      Buffer.from([0x03]),
    ]);

    expect(parseIppResponse(response).attributes.get('document-format-supported')).toBe(
      'application/pdf',
    );
  });

  it('rejects a truncated response', () => {
    expect(() => parseIppResponse(Buffer.from([2, 0]))).toThrow('truncated');
  });
});

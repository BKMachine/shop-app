/**
 * Gets a phone photo ready for the shop printers (POST /printers/:id/print), the
 * same way the Android app does: upright, at most 2400 px on the long side, as
 * JPEG, with the time it was taken formatted like "2026-11-26 3:42 PM".
 */

const MAX_LONG_SIDE = 2400;
const JPEG_QUALITY = 0.9;
/** Types the server's image processing accepts as-is for uploads. */
const UPLOADABLE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type PreparedPhoto = {
  /** Upright, downscaled JPEG for printing. */
  printBlob: Blob;
  /** What to upload: the original when the server takes its type, else the JPEG. */
  uploadBlob: Blob;
  uploadName: string;
  /** Capture time in the phone's local time, e.g. "2026-11-26 3:42 PM". */
  timestamp: string;
};

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const image = await loadImage(file);
  // Browsers apply the EXIF orientation when decoding <img>, so the natural size
  // is already upright and drawImage paints it the right way up.
  const scale = Math.min(1, MAX_LONG_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.round(image.naturalWidth * scale);
  const height = Math.round(image.naturalHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot prepare photos.');
  context.drawImage(image, 0, 0, width, height);

  const printBlob = await canvasToJpeg(canvas);
  const takenAt = exifDateTime(new Uint8Array(await file.arrayBuffer()));
  const timestamp = takenAt ?? formatTimestamp(new Date(file.lastModified || Date.now()));

  const keepOriginal = UPLOADABLE_TYPES.has(file.type);
  return {
    printBlob,
    uploadBlob: keepOriginal ? file : printBlob,
    uploadName: keepOriginal ? file.name || 'photo.jpg' : 'photo.jpg',
    timestamp,
  };
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('This image could not be read.'));
    };
    image.src = url;
  });
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the photo.'))),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
}

/** "2026-11-26 3:42 PM" */
export function formatTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  const hours = date.getHours() % 12 || 12;
  const meridiem = date.getHours() < 12 ? 'AM' : 'PM';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${hours}:${pad(date.getMinutes())} ${meridiem}`;
}

/**
 * DateTimeOriginal (else DateTime) from a JPEG's EXIF block, formatted like
 * formatTimestamp. EXIF times are the camera's local wall-clock time, so they're
 * used as-is. Returns null for non-JPEGs or photos without a usable time.
 */
export function exifDateTime(bytes: Uint8Array): string | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;

  // Walk the JPEG segments to APP1 "Exif\0\0".
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset);
    const length = view.getUint16(offset + 2);
    if (marker === 0xffe1 && readAscii(bytes, offset + 4, 6) === 'Exif\0\0') {
      return readTiffDateTime(view, bytes, offset + 10);
    }
    if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) return null; // start of image data
    offset += 2 + length;
  }
  return null;
}

function readTiffDateTime(view: DataView, bytes: Uint8Array, tiffStart: number): string | null {
  if (tiffStart + 8 > view.byteLength) return null;
  const littleEndian = view.getUint16(tiffStart) === 0x4949; // "II"
  const u16 = (at: number) => view.getUint16(at, littleEndian);
  const u32 = (at: number) => view.getUint32(at, littleEndian);

  const readEntries = (ifdOffset: number) => {
    const entries = new Map<number, number>();
    const start = tiffStart + ifdOffset;
    if (start + 2 > view.byteLength) return entries;
    const count = u16(start);
    for (let index = 0; index < count; index++) {
      const entry = start + 2 + index * 12;
      if (entry + 12 > view.byteLength) break;
      // Value offset field; ASCII values longer than 4 bytes live at this offset.
      entries.set(u16(entry), u32(entry + 8));
    }
    return entries;
  };

  const readText = (valueOffset: number | undefined) => {
    if (valueOffset === undefined) return null;
    const text = readAscii(bytes, tiffStart + valueOffset, 19);
    const match = text.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
    if (!match) return null;
    const [, year, month, day, hour, minute, second] = match.map(Number) as number[];
    if (!year) return null; // "0000:00:00 00:00:00" means unset
    return formatTimestamp(
      new Date(year, (month ?? 1) - 1, day ?? 1, hour ?? 0, minute ?? 0, second ?? 0),
    );
  };

  const ifd0 = readEntries(u32(tiffStart + 4));
  const exifIfdOffset = ifd0.get(0x8769);
  const exifIfd = exifIfdOffset !== undefined ? readEntries(exifIfdOffset) : new Map();

  return readText(exifIfd.get(0x9003)) ?? readText(ifd0.get(0x0132));
}

function readAscii(bytes: Uint8Array, start: number, length: number): string {
  if (start < 0 || start + length > bytes.length) return '';
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

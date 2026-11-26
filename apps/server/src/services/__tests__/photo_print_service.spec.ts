import { PDFDocument, StandardFonts } from 'pdf-lib';
import {
  buildPhotoPdf,
  layoutPhotoPage,
  toPrintableText,
  UnsupportedImageError,
  wrapText,
} from '../photo_print_service.js';

// 2x1 px PNG, so the photo is landscape.
const WIDE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAAD0lEQVR4nGP4z8DAwMAAAA0BAf9UmPoAAAAASUVORK5CYII=',
  'base64',
);

describe('layoutPhotoPage', () => {
  it('uses a portrait letter page for a tall photo and fills its height', () => {
    const layout = layoutPhotoPage(3000, 4000, []);
    expect(layout.landscape).toBe(false);
    expect([layout.pageWidth, layout.pageHeight]).toEqual([612, 792]);
    // Height is the limit: 792 - 2 * 28.8 margin - 18 footer.
    expect(layout.image.height).toBeCloseTo(716.4, 1);
    expect(layout.image.width / layout.image.height).toBeCloseTo(0.75, 5);
  });

  it('uses a landscape letter page for a wide photo and centres it', () => {
    const layout = layoutPhotoPage(4000, 3000, []);
    expect(layout.landscape).toBe(true);
    expect([layout.pageWidth, layout.pageHeight]).toEqual([792, 612]);
    const centre = layout.image.x + layout.image.width / 2;
    expect(centre).toBeCloseTo(396, 5);
  });

  it('leaves room at the top for caption lines', () => {
    const withoutCaption = layoutPhotoPage(3000, 4000, []);
    const withCaption = layoutPhotoPage(3000, 4000, ['One', 'Two']);
    expect(withCaption.image.height).toBeLessThan(withoutCaption.image.height);
    const top = withCaption.image.y + withCaption.image.height;
    expect(top).toBeLessThanOrEqual(792 - 28.8 - 2 * 20 - 8 + 0.001);
  });
});

describe('caption text', () => {
  it('replaces characters the standard fonts cannot draw', () => {
    expect(toPrintableText('Part 123 ✅\nok\t done')).toBe('Part 123 ? ok done');
  });

  it('wraps to two lines and marks the cut-off', async () => {
    const document = await PDFDocument.create();
    const font = await document.embedFont(StandardFonts.HelveticaBold);
    const text = Array.from({ length: 60 }, (_, index) => `word${index}`).join(' ');
    const lines = wrapText(text, font, 16, 300, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1]?.endsWith('...')).toBe(true);
    for (const line of lines) expect(font.widthOfTextAtSize(line, 16)).toBeLessThanOrEqual(300);
  });

  it('keeps short text on one line', async () => {
    const document = await PDFDocument.create();
    const font = await document.embedFont(StandardFonts.HelveticaBold);
    expect(wrapText('Short caption', font, 16, 300, 2)).toEqual(['Short caption']);
  });
});

describe('buildPhotoPdf', () => {
  it('makes one landscape letter page for a wide image', async () => {
    const pdf = await buildPhotoPdf({
      image: WIDE_PNG,
      caption: 'Fixture plate',
      timestamp: '2026-11-26 3:42 PM',
    });
    const document = await PDFDocument.load(pdf);
    expect(document.getPageCount()).toBe(1);
    const { width, height } = document.getPage(0).getSize();
    expect([width, height]).toEqual([792, 612]);
  });

  it('rejects images that are not JPEG or PNG', async () => {
    await expect(
      buildPhotoPdf({ image: Buffer.from('GIF89a'), timestamp: 'now' }),
    ).rejects.toBeInstanceOf(UnsupportedImageError);
  });
});

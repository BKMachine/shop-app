import { randomUUID } from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
import { imageDir, tempDir } from '../directories.js';

export async function rotateImage(
  sourcePath: string,
  degrees: 90 | -90,
): Promise<{
  filename: string;
  mimeType: string;
  relPath: string;
}> {
  const filename = `${randomUUID()}.png`;
  const outputPath = path.join(tempDir, filename);

  const normalizedBuffer = await sharp(sourcePath, { failOn: 'none' }).rotate().toBuffer();

  await sharp(normalizedBuffer, { failOn: 'none' }).rotate(degrees).png().toFile(outputPath);

  return {
    filename,
    mimeType: 'image/png',
    relPath: path.relative(imageDir, outputPath).replace(/\\/g, '/'),
  };
}

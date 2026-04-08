import sharp from 'sharp';
import type { InputImage, ProcessedImage } from './image_processing_types.js';

export async function rotateImage(input: InputImage, degrees: 90 | -90): Promise<ProcessedImage> {
  const normalizedBuffer = await sharp(input.buffer, { failOn: 'none' }).rotate().toBuffer();
  const buffer = await sharp(normalizedBuffer, { failOn: 'none' }).rotate(degrees).png().toBuffer();

  return {
    buffer,
    mimeType: 'image/png',
    extension: '.png',
  };
}

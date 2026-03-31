import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { removeBackground } from '@imgly/background-removal-node';
import { imageDir, tempDir } from '../directories.js';

const require = createRequire(import.meta.url);
const backgroundRemovalEntryPath = require.resolve('@imgly/background-removal-node');
const backgroundRemovalDistDir = path.dirname(backgroundRemovalEntryPath);
const backgroundRemovalPublicPath = pathToFileURL(`${backgroundRemovalDistDir}${path.sep}`).href;

function getMimeTypeForSource(sourcePath: string): string {
  const ext = path.extname(sourcePath).toLowerCase();

  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';

  return 'application/octet-stream';
}

export async function removeImageBackground(sourcePath: string): Promise<{
  filename: string;
  mimeType: string;
  relPath: string;
}> {
  console.log(`Removing background for image: ${sourcePath}`);
  try {
    const sourceBuffer = fs.readFileSync(sourcePath);
    const sourceBlob = new Blob([sourceBuffer], { type: getMimeTypeForSource(sourcePath) });
    const resultBlob = await removeBackground(sourceBlob, {
      debug: true,
      model: 'small',
      output: {
        format: 'image/png',
        quality: 1,
      },
      publicPath: backgroundRemovalPublicPath,
    });

    const filename = `${randomUUID()}.png`;
    const outputPath = path.join(tempDir, filename);
    const resultBuffer = Buffer.from(await resultBlob.arrayBuffer());

    fs.writeFileSync(outputPath, resultBuffer);

    return {
      filename,
      mimeType: 'image/png',
      relPath: path.relative(imageDir, outputPath).replace(/\\/g, '/'),
    };
  } catch (error) {
    console.error('Background removal failed', {
      sourcePath,
      sourceMimeType: getMimeTypeForSource(sourcePath),
      backgroundRemovalPublicPath,
      error,
    });
    throw error;
  }
}

export type BackgroundRemovalBackend = 'imgly' | 'rembg';
export type BackgroundRemovalModel = 'small' | 'medium' | 'large';

export type ProcessedImage = {
  buffer: Buffer;
  mimeType: 'image/png';
  extension: '.png';
};

export type InputImage = {
  buffer: Buffer;
  filename?: string | null;
  mimeType?: string | null;
};

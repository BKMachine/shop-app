import fs from 'node:fs';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb } from 'pdf-lib';
import {
  ADDRESS_LABEL,
  type AddressLabelData,
  buildGrayscaleLogoBuffer,
  buildQrCodeWithCenteredLogoBuffer,
  fitTextToBox,
  inches,
  sanitize,
  segoeUiRegularPath,
  toPdfY,
} from './shared.js';

const ADDRESS_LAYOUT = {
  description: {
    x: 0.2430209,
    y: 0.06,
    width: 3.1,
    height: 0.31,
    fontSize: 16,
    minFontSize: 5,
  },
  logo: {
    x: 0.23,
    y: 0.5,
    width: 0.53,
    height: 0.58,
  },
  brand: {
    x: 1.23,
    y: 0.55,
    width: 1.18,
    height: 0.28,
    fontSize: 30,
    minFontSize: 12,
  },
  code: {
    x: 2.84,
    y: 0.49,
    width: 0.49,
    height: 0.49,
  },
};

export async function buildAddressLabel(data: AddressLabelData) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const page = pdf.addPage([ADDRESS_LABEL.width, ADDRESS_LABEL.height]);
  const sans = await pdf.embedFont(fs.readFileSync(segoeUiRegularPath));

  const description = sanitize(data.description);
  const item = sanitize(data.item);
  const brand = sanitize(data.brand);
  const squareCodeValue = sanitize(data.barcode) || item;

  const descriptionWidth = inches(ADDRESS_LAYOUT.description.width);
  const descriptionHeight = inches(ADDRESS_LAYOUT.description.height);
  const descriptionX = inches(ADDRESS_LAYOUT.description.x);
  const descriptionY = toPdfY(
    ADDRESS_LABEL.height,
    ADDRESS_LAYOUT.description.y,
    ADDRESS_LAYOUT.description.height,
  );
  const descriptionSize = fitTextToBox(
    sans,
    description,
    descriptionWidth,
    descriptionHeight - 2,
    ADDRESS_LAYOUT.description.fontSize,
    ADDRESS_LAYOUT.description.minFontSize,
  );
  const descriptionTextWidth = sans.widthOfTextAtSize(description, descriptionSize);
  const descriptionTextHeight = sans.heightAtSize(descriptionSize);

  page.drawText(description, {
    x: descriptionX + Math.max(0, (descriptionWidth - descriptionTextWidth) / 2),
    y: descriptionY + (descriptionHeight - descriptionTextHeight) / 2 + 1,
    size: descriptionSize,
    font: sans,
    color: rgb(0, 0, 0),
  });

  const logoBuffer = await buildGrayscaleLogoBuffer(
    inches(ADDRESS_LAYOUT.logo.width),
    inches(ADDRESS_LAYOUT.logo.height),
  );
  const logoImage = await pdf.embedPng(logoBuffer);
  page.drawImage(logoImage, {
    x: inches(ADDRESS_LAYOUT.logo.x),
    y: toPdfY(ADDRESS_LABEL.height, ADDRESS_LAYOUT.logo.y, ADDRESS_LAYOUT.logo.height),
    width: inches(ADDRESS_LAYOUT.logo.width),
    height: inches(ADDRESS_LAYOUT.logo.height),
  });

  const brandWidth = inches(ADDRESS_LAYOUT.brand.width);
  const brandHeight = inches(ADDRESS_LAYOUT.brand.height);
  const brandX = inches(ADDRESS_LAYOUT.brand.x);
  const brandY = toPdfY(ADDRESS_LABEL.height, ADDRESS_LAYOUT.brand.y, ADDRESS_LAYOUT.brand.height);

  if (brand) {
    const brandSize = fitTextToBox(
      sans,
      brand,
      brandWidth,
      brandHeight,
      ADDRESS_LAYOUT.brand.fontSize,
      ADDRESS_LAYOUT.brand.minFontSize,
    );
    const brandTextWidth = sans.widthOfTextAtSize(brand, brandSize);
    const brandTextHeight = sans.heightAtSize(brandSize);
    page.drawText(brand, {
      x: brandX + Math.max(0, (brandWidth - brandTextWidth) / 2),
      y: brandY + (brandHeight - brandTextHeight) / 2 + 1,
      size: brandSize,
      font: sans,
      color: rgb(0, 0, 0),
    });
  }

  const codeImage = await pdf.embedPng(
    await buildQrCodeWithCenteredLogoBuffer(squareCodeValue, 512),
  );
  page.drawImage(codeImage, {
    x: inches(ADDRESS_LAYOUT.code.x),
    y: toPdfY(ADDRESS_LABEL.height, ADDRESS_LAYOUT.code.y, ADDRESS_LAYOUT.code.height),
    width: inches(ADDRESS_LAYOUT.code.width),
    height: inches(ADDRESS_LAYOUT.code.height),
  });

  return Buffer.from(await pdf.save());
}

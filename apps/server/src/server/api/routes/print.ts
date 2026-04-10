import { type NextFunction, type Request, type Response, Router } from 'express';
import logger from '../../../logger.js';
import CupsService from '../../../services/cups_service.js';
import {
  buildAddressLabelPdf,
  buildLocationLabelPdf,
  buildPartPositionLabelPdf,
} from '../../../services/image_processor_client.js';
import HttpError from '../../middleware/httpError.js';
import { assertKnownDevice, requireKnownDevice } from '../../middleware/knownDevices.js';

const router: Router = Router();

function getPartLabelImageBaseUrl() {
  return process.env.PART_LABEL_IMAGE_BASE_URL?.trim() || process.env.BASE_URL?.trim() || '';
}

function resolvePartImageUrlForLabel(partImageUrl: string | undefined) {
  if (!partImageUrl) return undefined;

  const baseUrl = getPartLabelImageBaseUrl();
  try {
    const sourceUrl = new URL(partImageUrl);
    if (!baseUrl) return sourceUrl.toString();

    if (!sourceUrl.pathname.startsWith('/images/')) {
      return sourceUrl.toString();
    }

    return new URL(`${sourceUrl.pathname}${sourceUrl.search}`, `${baseUrl}/`).toString();
  } catch {
    if (!baseUrl || !partImageUrl.startsWith('/images/')) {
      return partImageUrl;
    }

    return new URL(partImageUrl, `${baseUrl}/`).toString();
  }
}

router.post('/print/location', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { loc, pos }: PrintLocationBody = req.body;
  if (!loc || !pos) return next(new HttpError(400, 'loc and pos are required.'));

  try {
    const pdf = await buildLocationLabelPdf({ loc, pos });
    await CupsService.printLocationLabel(pdf.buffer, { loc, pos }).catch((error) => {
      logger.warn(
        `CUPS location print failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="location-label-preview.pdf"');
    res.status(200).send(pdf.buffer);
  } catch (e) {
    next(e);
  }
});

async function sendAddressLabel(req: Request, res: Response, next: NextFunction) {
  assertKnownDevice(req);
  const { item, description, brand, barcode } = req.body as PrintItemBody & {
    barcode?: string;
  };
  if (!item || !description) return next(new HttpError(400, 'item and description are required.'));

  try {
    const pdf = await buildAddressLabelPdf({ item, description, brand, barcode });
    await CupsService.printAddressLabel(pdf.buffer, { item, description, brand }).catch((error) => {
      logger.warn(
        `CUPS address print failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="address-label-preview.pdf"');
    res.status(200).send(pdf.buffer);
  } catch (e) {
    next(e);
  }
}

router.post('/print/address', requireKnownDevice, sendAddressLabel);
router.post('/print/item', requireKnownDevice, sendAddressLabel);

router.post('/print/part-position', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { partId, part, description, loc, pos, partImageUrl }: PrintPartPositionBody = req.body;
  if (!partId || !part || !description || !loc || !pos) {
    return next(new HttpError(400, 'partId, part, description, loc, and pos are required.'));
  }

  try {
    const resolvedPartImageUrl = resolvePartImageUrlForLabel(partImageUrl);
    if (resolvedPartImageUrl) {
      logger.info(`Part label image URL resolved to ${resolvedPartImageUrl}`);
    }
    const pdf = await buildPartPositionLabelPdf({
      partId,
      part,
      description,
      loc,
      pos,
      partImageUrl: resolvedPartImageUrl,
    });
    await CupsService.printAddressLabel(pdf.buffer, {
      item: part,
      description,
      brand: `${loc} | ${pos}`,
    }).catch((error) => {
      logger.warn(
        `CUPS part position print failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="part-position-label-preview.pdf"');
    res.status(200).send(pdf.buffer);
  } catch (e) {
    next(e);
  }
});

export default router;

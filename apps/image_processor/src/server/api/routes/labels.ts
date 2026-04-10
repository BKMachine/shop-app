import { type NextFunction, type Request, type Response, Router } from 'express';
import LabelPdfService from '../../../services/label_pdf_service.js';
import HttpError from '../../middleware/httpError.js';

const router: Router = Router();

router.post('/location', async (req, res, next) => {
  const { loc, pos }: PrintLocationBody = req.body;
  if (!loc || !pos) return next(new HttpError(400, 'loc and pos are required.'));

  try {
    const pdf = await LabelPdfService.buildLocationLabel({ loc, pos });
    res.setHeader('Content-Type', 'application/pdf');
    res.status(200).send(pdf);
  } catch (error) {
    next(error);
  }
});

async function sendAddressLabel(req: Request, res: Response, next: NextFunction) {
  const { item, description, brand, barcode } = req.body as PrintItemBody & {
    barcode?: string;
  };
  if (!item || !description) return next(new HttpError(400, 'item and description are required.'));

  try {
    const pdf = await LabelPdfService.buildAddressLabel({ item, description, brand, barcode });
    res.setHeader('Content-Type', 'application/pdf');
    res.status(200).send(pdf);
  } catch (error) {
    next(error);
  }
}

router.post('/address', sendAddressLabel);
router.post('/item', sendAddressLabel);

router.post('/part-position', async (req, res, next) => {
  const { partId, part, description, loc, pos, partImageUrl }: PrintPartPositionBody = req.body;
  if (!partId || !part || !description || !loc || !pos) {
    return next(new HttpError(400, 'partId, part, description, loc, and pos are required.'));
  }

  try {
    const pdf = await LabelPdfService.buildPartPositionLabel({
      partId,
      part,
      description,
      loc,
      pos,
      partImageUrl,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.status(200).send(pdf);
  } catch (error) {
    next(error);
  }
});

export default router;

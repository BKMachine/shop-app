import { Router } from 'express';
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

router.post('/item', async (req, res, next) => {
  const { item, description, brand, barcode } = req.body as PrintItemBody & { barcode?: string };
  if (!item || !description) return next(new HttpError(400, 'item and description are required.'));

  try {
    const pdf = await LabelPdfService.buildItemLabel({ item, description, brand, barcode });
    res.setHeader('Content-Type', 'application/pdf');
    res.status(200).send(pdf);
  } catch (error) {
    next(error);
  }
});

export default router;

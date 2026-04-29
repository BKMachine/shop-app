import { Router } from 'express';
import LabelPdfService from '../../../services/label_service/index.js';
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
  const { identifier, description, entity, loc, pos, qrText, imageUrl }: PrintItemBody = req.body;
  if (!identifier || !description || !entity || !loc || !pos || !qrText) {
    return next(
      new HttpError(400, 'identifier, description, entity, loc, pos, and qrText are required.'),
    );
  }

  try {
    const pdf = await LabelPdfService.buildItemLabel({
      identifier,
      description,
      entity,
      loc,
      pos,
      qrText,
      imageUrl,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.status(200).send(pdf);
  } catch (error) {
    next(error);
  }
});

export default router;

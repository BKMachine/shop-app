import { Router } from 'express';
import multer from 'multer';
import Materials from '../../../database/lib/material/material_service.js';
import { buildHighlightedPdf } from '../../../services/pdfs/pdf_highlight_service.js';
import pdfParserService from '../../../services/pdfs/pdf_parser_service.js';
import HttpError from '../../middleware/httpError.js';
import requireKnownDevice from '../../middleware/requireKnownDevices.js';

const router: Router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/materials', async (_req, res, next) => {
  try {
    const data = await Materials.list();
    res.status(200).json(data);
  } catch (e) {
    next(e);
  }
});

router.post('/materials', requireKnownDevice, async (req, res, next) => {
  const { data }: { data: Material | undefined } = req.body;
  if (!data) return next(new HttpError(400, 'No material data provided.'));
  if (!req.deviceId) return next(new HttpError(401, 'Unauthorized: device not recognized.'));

  try {
    const doc = await Materials.add(data, req.deviceId);
    res.status(200).json(doc);
  } catch (e) {
    next(e);
  }
});

router.put('/materials', requireKnownDevice, async (req, res, next) => {
  const { data }: { data: Material | undefined } = req.body;
  if (!data) return next(new HttpError(400, 'No material data provided.'));
  if (!req.deviceId) return next(new HttpError(401, 'Unauthorized: device not recognized.'));

  try {
    const response = await Materials.update(data, req.deviceId);
    if (!response) return next(new HttpError(404, 'Material not found.'));
    res.status(200).json(response);
  } catch (e) {
    next(e);
  }
});

router.post('/materials/parse-pdf', upload.single('pdf'), async (req, res, next) => {
  if (!req.file) return next(new HttpError(400, 'No PDF file uploaded.'));
  if (req.file.mimetype !== 'application/pdf')
    return next(new HttpError(400, 'Uploaded file must be a PDF.'));

  try {
    const { parsedResults, previewResults } = await pdfParserService(req.file.buffer);
    const highlightedPdfBuffer = await buildHighlightedPdf(req.file.buffer, parsedResults);
    const response: ParsePdfResponse = {
      previews: previewResults,
      highlightedPdf: highlightedPdfBuffer ? highlightedPdfBuffer.toString('base64') : null,
    };
    res.status(200).json(response);
  } catch (e) {
    next(e);
  }
});

router.post('/materials/parse-pdf/apply', requireKnownDevice, async (req, res, next) => {
  const { updates }: { updates: MaterialApplyUpdate[] | undefined } = req.body;
  if (!updates || !Array.isArray(updates))
    return next(new HttpError(400, 'updates array is required.'));
  if (!req.deviceId) return next(new HttpError(401, 'Unauthorized: device not recognized.'));

  try {
    const updated = await Promise.all(
      updates.map(async ({ materialId, costPerFoot }) => {
        return await Materials.updateCostPerFoot(materialId, costPerFoot, req.deviceId);
      }),
    );

    res.status(200).json(updated.filter(Boolean));
  } catch (e) {
    next(e);
  }
});

export default router;

import { Router } from 'express';
import multer from 'multer';
import * as z from 'zod';
import Materials from '../../../database/lib/material/material_service.js';
import logger from '../../../logger.js';
import { buildHighlightedPdf } from '../../../services/pdfs/pdf_highlight_service.js';
import pdfParserService from '../../../services/pdfs/pdf_parser_service.js';
import mongoObjectId from '../../../utilities/mongoObjectId.js';
import HttpError from '../../middleware/httpError.js';
import { assertKnownDevice, requireKnownDevice } from '../../middleware/knownDevices.js';

const router: Router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const CreateMaterialRequest = z.strictObject({
  material: z.strictObject({
    description: z.string(),
    type: z.enum(['Round', 'Flat']),
    height: z.number().nullable(),
    width: z.number().nullable(),
    diameter: z.number().nullable(),
    wallThickness: z.number().nullable(),
    length: z.number().nullable(),
    materialType: z.string(),
    supplier: mongoObjectId,
    costPerFoot: z.number().nullable(),
  }),
});
export type CreateMaterialPayload = z.infer<typeof CreateMaterialRequest.shape.material>;

const UpdateMaterialRequest = z.strictObject({
  material: CreateMaterialRequest.shape.material.extend({
    _id: mongoObjectId,
    __v: z.number().optional(),
  }),
});
export type UpdateMaterialPayload = z.infer<typeof UpdateMaterialRequest.shape.material>;

const MaterialApplyUpdateRequest = z.strictObject({
  updates: z.array(
    z.strictObject({
      materialId: mongoObjectId,
      costPerFoot: z.number(),
    }),
  ),
});

router.get('/materials', async (_req, res, next) => {
  try {
    const data = await Materials.list();
    res.status(200).json(data);
  } catch (e) {
    next(e);
  }
});

router.post('/materials', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { success, data, error } = CreateMaterialRequest.safeParse(req.body);
  if (!success) {
    logger.error('Invalid material data provided:', error.message);
    return next(new HttpError(400, 'Invalid material data.'));
  }

  try {
    const doc = await Materials.create(data.material, req.deviceId);
    res.status(200).json(doc);
  } catch (e) {
    next(e);
  }
});

router.put('/materials', requireKnownDevice, async (req, res, next) => {
  assertKnownDevice(req);
  const { success, data, error } = UpdateMaterialRequest.safeParse(req.body);
  if (!success) {
    logger.error('Invalid material data provided:', error.message);
    return next(new HttpError(400, 'Invalid material data.'));
  }

  try {
    const response = await Materials.update(data.material, req.deviceId);
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
  assertKnownDevice(req);
  const { success, data, error } = MaterialApplyUpdateRequest.safeParse(req.body);
  if (!success) {
    logger.error('Invalid updates data provided:', error.message);
    return next(new HttpError(400, 'Invalid updates data.'));
  }

  try {
    const updated = await Promise.all(
      data.updates.map(async ({ materialId, costPerFoot }) => {
        return await Materials.updateCostPerFoot(materialId, costPerFoot, req.deviceId);
      }),
    );

    res.status(200).json(updated.filter(Boolean));
  } catch (e) {
    next(e);
  }
});

export default router;

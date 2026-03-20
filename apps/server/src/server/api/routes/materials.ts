import { Router } from 'express';
import multer from 'multer';
import Materials from '../../../database/lib/material/material_service.js';
import parseMaterialPdf, {
  type ParserResults,
} from '../../../services/pdfs/material_pdf_parser.js';
import { buildHighlightedPdf } from '../../../services/pdf_highlight_service.js';
import requireKnownDevice from '../../middleware/requireKnownDevices.js';

const router: Router = Router();
const upload = multer({ storage: multer.memoryStorage() });

interface MaterialParsePreview {
  parsed: ParserResults;
  existingMaterial: Material | null;
  currentCostPerFoot: number | null;
  proposedCostPerFoot: number;
  hasCostChange: boolean;
}

interface MaterialApplyUpdate {
  materialId: string;
  costPerFoot: number;
}

interface ParsePdfResponse {
  previews: MaterialParsePreview[];
  highlightedPdf: string | null;
}

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
  if (!data) {
    res.sendStatus(400);
    return;
  }
  if (!req.device) {
    res.sendStatus(401);
    return;
  }

  try {
    const doc = await Materials.add(data, req.device._id.toString());
    res.status(200).json(doc);
  } catch (e) {
    next(e);
  }
});

router.put('/materials', requireKnownDevice, async (req, res, next) => {
  const { data }: { data: Material | undefined } = req.body;
  if (!data) {
    res.sendStatus(400);
    return;
  }
  if (!req.device) {
    res.sendStatus(401);
    return;
  }
  try {
    const response = await Materials.update(data, req.device._id.toString());
    if (!response) {
      res.sendStatus(404);
      return;
    }
    res.status(200).json(response);
  } catch (e) {
    next(e);
  }
});

router.post('/materials/parse-pdf', upload.single('pdf'), async (req, res, next) => {
  if (!req.file) {
    res.status(400).json({ error: 'No PDF file uploaded.' });
    return;
  }

  if (req.file.mimetype !== 'application/pdf') {
    res.status(400).json({ error: 'Uploaded file must be a PDF.' });
    return;
  }

  try {
    const parsedResults: ParserResults[] = await parseMaterialPdf(req.file.buffer);

    const previewResults: MaterialParsePreview[] = await Promise.all(
      parsedResults.map(async (parsed) => {
        const existing = await Materials.findByParsedMaterial(parsed.material);
        const currentCostPerFoot = existing?.costPerFoot ?? null;

        const existingMaterial = existing
          ? ({
              ...existing.toObject(),
              _id: existing._id.toString(),
            } as Material)
          : null;

        return {
          parsed,
          existingMaterial,
          currentCostPerFoot,
          proposedCostPerFoot: parsed.costPerFoot,
          hasCostChange: existing ? currentCostPerFoot !== parsed.costPerFoot : false,
        };
      }),
    );

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

  if (!updates || !Array.isArray(updates)) {
    res.status(400).json({ error: 'updates array is required.' });
    return;
  }

  if (!req.device) {
    res.sendStatus(401);
    return;
  }

  const deviceId = req.device._id.toString();

  try {
    const updated = await Promise.all(
      updates.map(async ({ materialId, costPerFoot }) => {
        return await Materials.updateCostPerFoot(materialId, costPerFoot, deviceId);
      }),
    );

    res.status(200).json(updated.filter(Boolean));
  } catch (e) {
    next(e);
  }
});

export default router;

import Materials from '../../database/lib/material/material_service.js';
import parseMaterialPdf from '../../services/pdfs/material_pdf_parser.js';

export default async function (buffer: Buffer): Promise<{
  parsedResults: ParserResults[];
  previewResults: MaterialParsePreview[];
}> {
  const parsedResults: ParserResults[] = await parseMaterialPdf(buffer);

  const previewResults: MaterialParsePreview[] = await Promise.all(
    parsedResults.map(async (parsed) => {
      const existing = await Materials.findByParsedMaterial(parsed.material);
      const currentCostPerFoot = existing?.costPerFoot ?? null;

      const existingMaterial = existing
        ? ({
            ...(existing as unknown as { toObject(): Material }).toObject(),
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

  return { parsedResults, previewResults };
}

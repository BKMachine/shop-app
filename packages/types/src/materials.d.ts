declare global {
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
}

export {};

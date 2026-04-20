declare global {
  interface MaterialFields {
    description: string;
    type: 'Flat' | 'Round';
    height: number | null;
    width: number | null;
    diameter: number | null;
    wallThickness: number | null;
    length: number | null;
    materialType: string;
    costPerFoot: number | null;
  }

  interface Material extends MaterialFields {
    _id: string;
    supplier: Supplier;
  }

  interface MaterialCreate extends MaterialFields {
    supplier: string;
  }

  interface MaterialUpdate extends MaterialFields {
    _id: string;
    supplier: string;
    __v?: number;
  }

  type MaterialCategory = 'aluminum' | 'steel' | 'stainless' | 'titanium' | 'other';

  interface MaterialList {
    [key: string]: {
      density: number;
      category: MaterialCategory;
    };
  }

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

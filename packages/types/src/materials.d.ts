import type { Document, Types } from 'mongoose';

declare global {
  interface Material {
    _id: string;
    description: string;
    type: 'Flat' | 'Round';
    height: number | null;
    width: number | null;
    diameter: number | null;
    wallThickness: number | null;
    length: number | null;
    materialType: string;
    supplier: Supplier;
    costPerFoot: number | null;
  }

  interface MaterialDoc extends Material, Document<Types.ObjectId> {
    _id: Types.ObjectId;
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

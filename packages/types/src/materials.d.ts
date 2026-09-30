declare global {
  // 'stock' is bar/tube cut to length; 'piece' is a pre-formed blank (molding, casting, ...)
  // consumed one or more per part. Documents saved before `kind` existed are stock.
  type MaterialKind = 'stock' | 'piece';
  type MaterialShape = 'Flat' | 'Round';
  type MaterialPieceForm = 'Molding' | 'Casting' | 'Forging' | 'Weldment' | 'Blank';

  interface MaterialFields {
    description: string;
    kind: MaterialKind;
    type: MaterialShape | null;
    form: MaterialPieceForm | null;
    // Piece only: distinguishes pieces sharing type + form, e.g. "Trigger Box".
    name: string | null;
    isMetric: boolean;
    height: number | null;
    width: number | null;
    diameter: number | null;
    wallThickness: number | null;
    length: number | null;
    materialType: string;
    costPerFoot: number | null;
    costPerPiece: number | null;
  }

  interface Material extends MaterialFields {
    _id: string;
    supplier: Supplier | null;
  }

  interface MaterialCreate extends MaterialFields {
    supplier: string | null;
  }

  interface MaterialUpdate extends MaterialFields {
    _id: string;
    supplier: string | null;
    __v?: number;
  }

  type MaterialCategory = 'aluminum' | 'steel' | 'stainless' | 'titanium' | 'plastic' | 'other';

  interface MaterialList {
    [key: string]: {
      density: number | null;
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

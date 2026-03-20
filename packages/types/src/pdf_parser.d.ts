/// <reference path="../index.d.ts" />

declare global {
  interface LineHighlight {
    text: string;
    label: string;
  }

  interface ParsedLineContext {
    separator: string;
    header: string;
    sizes: string;
    override: string;
    amounts: string;
    headerHighlights: LineHighlight[];
    sizesHighlights: LineHighlight[];
    overrideHighlights: LineHighlight[];
    amountsHighlights: LineHighlight[];
  }

  interface ParserResults {
    material: Partial<Material>;
    costPerFoot: number;
    unitType: string;
    rate: number;
    weight: number;
    feet: number;
    lineContext: ParsedLineContext;
  }
}

export {};

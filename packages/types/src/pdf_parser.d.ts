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
    date: string;
    headerHighlights: LineHighlight[];
    sizesHighlights: LineHighlight[];
    overrideHighlights: LineHighlight[];
    amountsHighlights: LineHighlight[];
    dateHighlights: LineHighlight[];
  }

  interface ParserResults {
    material: Partial<MaterialCreate>;
    costPerFoot: number;
    unitType: string;
    rate: number;
    weight: number;
    feet: number;
    lineContext: ParsedLineContext;
    createdAt: Date;
  }
}

export {};

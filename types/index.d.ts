interface Rules {
  [key: string]: (value: string) => boolean | string;
}

interface ToolDoc {
  _id: string;
  description: string;
  vendor?: string;
  supplier?: string;
  item?: string;
  barcode?: string;
  stock: number;
  img?: string;
  category: ToolCategory;
  coating?: string;
  flutes?: number;
  autoReorder: boolean;
  reorderQty: number;
  reorderThreshold: number;
  productLink?: string;
  techDataLink?: string;
  cost?: number;
  onOrder: boolean;
  orderedOn?: string;
  location?: string;
  position?: string;
}

type ToolCategory = 'milling' | 'turning' | 'other';

interface ToolDoc_Pop extends ToolDoc {
  vendor?: VendorDoc | string;
  supplier?: SupplierDoc | string;
}

interface VendorDoc {
  _id: string;
  name: string;
  logo?: string;
  homepage?: string;
  coatings?: string[];
}

interface SupplierDoc {
  _id: string;
  name: string;
  logo?: string;
  homepage?: string;
}

interface CustomerDoc {
  _id: string;
  name: string;
  logo?: string;
  homepage?: string;
}

interface PrintLocationBody {
  loc: string;
  pos: string;
}

interface PrintRequest {
  printerName: string;
  labelXml: string;
}

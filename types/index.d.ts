interface Rules {
  [key: string]: (value: string) => boolean | string;
}

interface ToolDoc {
  _id: string;
  description: string;
  vendor?: string;
  item?: string;
  barcode?: string;
  stock: number;
  img?: string;
  category: 'milling' | 'turning';
  coating?: string;
  flutes?: number;
  autoReorder: boolean;
  reorderQty?: number;
  reorderThreshold?: number;
  productLink?: string;
  techDataLink?: string;
  cost?: number;
}

interface ToolDocPopulated {
  vendor?: VendorDoc;
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

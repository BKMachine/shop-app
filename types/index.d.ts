type ObjectId = import('mongoose').Types.ObjectId;

interface Rules {
  [key: string]: (value: string) => boolean | string;
}

interface Tool {
  description: string;
  _vendor?: VendorDoc['_id'];
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

interface ToolDocProp extends ToolDoc {
  _vendor?: VendorDoc;
}

interface ToolDoc extends Tool {
  _id: ObjectId;
}

interface Vendor {
  name: string;
  logo?: string;
  homepage?: string;
  coatings?: string[];
}

interface VendorDoc extends Vendor {
  _id: ObjectId;
}

interface Supplier {
  name: string;
  logo?: string;
  homepage?: string;
}

interface SupplierDoc extends Supplier {
  _id: ObjectId;
}

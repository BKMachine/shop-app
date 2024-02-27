type ObjectId = import('mongoose').Types.ObjectId;

interface Rules {
  [key: string]: (value: string) => boolean | string;
}

interface Tool {
  description: string;
  _vendor?: VendorDoc['_id'];
  item?: string;
  stock: number;
  img?: string;
  type: 'milling' | 'turning';
  coating?: string;
  flutes?: number;
}

interface ToolDoCProp extends ToolDoc {
  _vendor?: VendorDoc;
}

interface ToolDoc extends Tool {
  _id: ObjectId;
}

interface Vendor {
  name: string;
  logo?: string;
  homepage?: string;
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

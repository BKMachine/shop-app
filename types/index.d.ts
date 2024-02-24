interface Rules {
  [key: string]: (value: string) => boolean | string;
}

interface Tool {
  description: string;
  item: string;
  manufacturer: ToolManufacturerDoc;
  vendor: string;
  stock: number;
  price: number;
  productPage: string;
  img: string;
}

interface ToolDoc extends Tool {
  _id: string;
}

interface Vendor {
  name: string;
  logo?: string;
  homepage?: string;
}

interface VendorDoc extends Vendor {
  _id: string;
}

interface Supplier {
  name: string;
  logo?: string;
  homepage?: string;
}

interface SupplierDoc extends Supplier {
  _id: string;
}

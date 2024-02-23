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

interface ToolManufacturer {
  name: string;
  logo?: string;
}

interface ToolManufacturerDoc extends ToolManufacturer {
  _id: string;
}

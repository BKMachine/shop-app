interface Rules {
  [key: string]: (value: string) => boolean | string;
}

interface ToolDocBase {
  _id: string;
  description: string;
  vendor?: VendorDoc | string;
  supplier?: SupplierDoc | string;
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
  cost: number;
  onOrder: boolean;
  orderedOn?: string;
  location?: string;
  position?: string;
  cuttingDia?: number;
  fluteLength?: number;
}

interface MillingTool extends ToolDocBase {
  toolType: MillingToolType;
}

interface TurningTool extends ToolDocBase {
  toolType: TurningToolType;
}

interface OtherTool extends ToolDocBase {
  toolType: OtherToolType;
}

type ToolDoc = MillingTool | TurningTool | OtherTool;

type ToolCategory = 'milling' | 'turning' | 'other';
type MillingToolType = import('../www/src/plugins/toolTypes').MillingType;
type TurningToolType = import('../www/src/plugins/toolTypes').TurningType;
type OtherToolType = import('../www/src/plugins/toolTypes').OtherType;

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

interface PrintItemBody {
  item: string;
  description: string;
  brand: string;
}

interface PrintRequest {
  printerName: string;
  labelXml: string;
}

interface ToolReorders extends ToolDoc {
  item: string;
  vendor: VendorDoc;
  supplier: SupplierDoc;
}

type ToolDocReorders = ToolDoc & ToolReorders;

interface AuditDoc {
  _id: string;
  type: 'newTool' | 'updateTool';
  timestamp: string;
  old: any | null;
  new: any;
}

interface PartDoc {
  _id: string;
  customer: CustomerDoc | string;
  part: string;
  description: string;
  stock: number;
  location?: string;
  position?: string;
  img?: string;
  revision?: string;
}

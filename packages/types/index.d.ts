/// <reference path="./src/database.d.ts" />
/// <reference path="./src/elastic.d.ts" />
/// <reference path="./src/machine.d.ts" />
/// <reference path="./src/mtconnect.d.ts" />
/// <reference path="./src/remote_serial_port.d.ts" />
/// <reference path="./src/socket.io.d.ts" />

interface Rules {
  [key: string]: (value: string) => boolean | string;
}

interface ToolDocBase {
  _id: string;
  description: string;
  vendor?: Vendor | string;
  supplier?: Supplier | string;
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

type Tool = MillingTool | TurningTool | OtherTool;

type ToolCategory = 'milling' | 'turning' | 'swiss' | 'other';
type MillingToolType = import('../www/src/plugins/toolTypes').MillingType;
type TurningToolType = import('../www/src/plugins/toolTypes').TurningType;
type OtherToolType = import('../www/src/plugins/toolTypes').OtherType;

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
  vendor: Vendor;
  supplier: Supplier;
}

type ToolDocReorders = ToolDoc & ToolReorders;

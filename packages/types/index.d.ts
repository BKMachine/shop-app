/// <reference path="./src/database.d.ts" />
/// <reference path="./src/elastic.d.ts" />
/// <reference path="./src/machine.d.ts" />
/// <reference path="./src/mtconnect.d.ts" />
/// <reference path="./src/remote_serial_port.d.ts" />
/// <reference path="./src/socket.io.d.ts" />
/// <reference path="./src/express.d.ts" />
/// <reference path="./src/pdf_parser.d.ts" />
/// <reference path="./src/materials.d.ts" />

declare global {
  type Rule = (value: string) => boolean | string;
  type Rules<Key extends string = string> = Record<Key, Rule>;

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
    orderLink?: string;
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

  type ToolCategory = 'milling' | 'turning' | 'swiss' | 'other' | 'all';
  type MillingToolType = import('../../apps/www/src/plugins/toolTypes').MillingType;
  type TurningToolType = import('../../apps/www/src/plugins/toolTypes').TurningType;
  type OtherToolType = import('../../apps/www/src/plugins/toolTypes').OtherType;

  interface PrintLocationBody {
    loc: string;
    pos: string;
  }

  interface PrintItemBody {
    item: string;
    description: string;
    brand: string;
  }

  interface PrintPartPositionBody {
    partId: string;
    part: string;
    description: string;
    loc: string;
    pos: string;
    partImageUrl?: string;
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

  interface RecentImage {
    id: string;
    url: string;
    createdAt: string;
  }

  type MaterialCategory = 'aluminum' | 'steel' | 'stainless' | 'titanium' | 'other';

  interface MaterialList {
    [key: string]: {
      density: number;
      category: MaterialCategory;
    };
  }

  interface MyImageData {
    id: string;
    url: string;
    createdAt: string;
    isMain?: boolean;
  }

  interface MyDocumentData {
    id: string;
    filename: string;
    originalName: string;
    url: string;
    mimeType?: string;
    extension?: string;
    size: number;
    createdAt: string;
  }

  interface MyPartNoteData {
    id: string;
    text: string;
    priority: 'critical' | 'default';
    createdAt: string;
    updatedAt: string;
    createdByDeviceId: string;
    createdByDisplayName: string;
    updatedByDeviceId: string;
    updatedByDisplayName: string;
  }
}

export {};

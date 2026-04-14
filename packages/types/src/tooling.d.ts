declare global {
  type ToolCategory = 'milling' | 'turning' | 'swiss' | 'other' | 'all';

  interface ToolBase {
    _id: string;
    description: string;
    vendor?: Vendor;
    supplier?: Supplier;
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

  type MillingToolType = import('../../../apps/www/src/plugins/toolTypes').MillingType;
  type TurningToolType = import('../../../apps/www/src/plugins/toolTypes').TurningType;
  type OtherToolType = import('../../../apps/www/src/plugins/toolTypes').OtherType;

  interface MillingTool extends ToolBase {
    toolType: MillingToolType;
  }

  interface TurningTool extends ToolBase {
    toolType: TurningToolType;
  }

  interface OtherTool extends ToolBase {
    toolType: OtherToolType;
  }

  type Tool = MillingTool | TurningTool | OtherTool;

  interface ToolDoc extends Omit<Tool, '_id'>, Document<Types.ObjectId> {
    _id: Types.ObjectId;
  }

  interface ToolListFilters {
    category?: ToolCategory;
    search?: string;
    toolType?: string;
    cuttingDia?: string;
    minFluteLength?: string;
    sort?: string;
    order?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  }

  type ToolListResult = {
    items: ToolDoc[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };

  interface ToolListResponse extends Omit<ToolListResult, 'items'> {
    items: Tool[];
  }

  interface ToolReorders extends ToolDoc {
    item: string;
    vendor: Vendor;
    supplier: Supplier;
  }

  type ToolDocReorders = ToolDoc & ToolReorders;
}

export {};

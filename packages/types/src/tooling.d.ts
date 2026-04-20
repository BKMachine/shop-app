import type { HydratedDocument } from 'mongoose';

declare global {
  interface ToolFields {
    description: string;
    item?: string;
    barcode?: string;
    stock: number;
    img?: string;
    category: ToolCategory;
    toolType?: string;
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

  interface Tool extends ToolFields {
    _id: string;
    vendor?: Vendor;
    supplier?: Supplier;
  }

  interface ToolCreate extends ToolFields {
    vendor?: string;
    supplier?: string;
  }

  interface ToolUpdate extends ToolCreate {
    _id: string;
    __v?: number;
  }

  interface ToolListItem extends Tool {
    vendor?: Vendor;
    supplier?: Supplier;
  }

  interface ToolReorder extends Tool {
    _id: Types.ObjectId;
    item: string;
    vendor: Vendor;
    supplier: Supplier;
  }

  type ToolCategory = 'milling' | 'turning' | 'swiss' | 'other';
  type ToolFilterCategory = ToolCategory | 'all';

  interface ToolCategoryGroups {
    milling: string[];
    turning: string[];
    swiss: string[];
    other: string[];
  }

  interface ToolListFilters {
    category?: ToolFilterCategory;
    search?: string;
    toolType?: string;
    location?: string;
    position?: string;
    cuttingDia?: string;
    minFluteLength?: string;
    sort?: string;
    order?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  }

  type ToolListResult = {
    items: Tool[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };

  interface ToolListDocs extends Omit<ToolListResult, 'items'> {
    items: HydratedDocument<ToolFields>[];
  }

  type ToolListResponse = ToolListResult;

  interface ToolCategorySettings {
    _id: 'tool-categories';
    groups: ToolCategoryGroups;
  }

  type ToolCategoryTypeCounts = Record<ToolCategory, Record<string, number>>;

  interface ToolCategorySettingsResponse extends ToolCategorySettings {
    counts: ToolCategoryTypeCounts;
  }
}

export {};

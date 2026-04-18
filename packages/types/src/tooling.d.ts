import type { Document, Types } from 'mongoose';

declare global {
  interface Tool {
    _id: string;
    description: string;
    vendor?: Vendor;
    supplier?: Supplier;
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

  interface ToolDoc extends Omit<Tool, '_id'>, Document<Types.ObjectId> {
    _id: Types.ObjectId;
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

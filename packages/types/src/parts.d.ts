declare global {
  interface Part {
    _id: string;
    customer: Customer;
    part: string;
    description: string;
    stock: number;
    location?: string;
    position?: string;
    img?: string;
    productLink?: string;
    partFilesPath?: string;
    revision?: string;
    material?: Material;
    customerSuppliedMaterial?: boolean;
    materialCutType: 'blanks' | 'bars';
    materialLength: number;
    barLength: number;
    remnantLength: number;
    createdAt: Date;
    cycleTimes: CycleTimes[];
    additionalCosts: AdditionalCost[];
    price: number;
    subComponentIds?: PartSubComponent[];
    imageIds?: string[];
    documentIds?: string[];
  }

  interface PartDoc extends Omit<Part, '_id'>, Document<Types.ObjectId> {
    _id: Types.ObjectId;
  }

  interface CycleTimes {
    operation: string;
    time: number;
  }

  interface AdditionalCost {
    name: string;
    cost: number;
    url?: string;
  }

  interface PartSubComponent {
    partId: string;
    qty: number;
  }

  interface PartListFilters {
    search?: string;
    customer?: string;
    includeSubcomponents?: boolean;
    sort?: string;
    order?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  }

  interface PartListItem extends Part {
    shopRate: number;
    hasSubComponents: boolean;
    isSubComponent: boolean;
    hasNoProductPrice: boolean;
  }

  interface PartListResult {
    items: PartListItem[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  }

  interface PartListResponse extends PartListResult {}
}

export {};

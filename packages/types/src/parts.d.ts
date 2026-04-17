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
    derived?: PartDerived;
  }

  interface PartDoc extends Omit<Part, '_id'>, Document<Types.ObjectId> {
    _id: Types.ObjectId;
  }

  interface PartDerived {
    shopRate: number;
    directSubComponentCount: number;
    directParentCount: number;
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
    location?: string;
    position?: string;
  }

  interface PartListItem extends Part {
    hasSubComponents: boolean;
    isSubComponent: boolean;
  }

  interface PartListResult {
    items: PartListItem[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  }

  interface PartListResponse extends PartListResult {}

  interface UpdatePartOptions {
    preserveManagedMediaFields?: boolean;
  }
}

export {};

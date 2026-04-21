declare global {
  interface PartFields {
    customer: string;
    part: string;
    description: string;
    stock: number;
    location?: string;
    position?: string;
    productLink?: string;
    partFilesPath?: string;
    revision?: string;
    material?: string | null;
    customerSuppliedMaterial?: boolean;
    materialCutType: 'blanks' | 'bars';
    materialLength: number;
    barLength: number;
    remnantLength: number;
    cycleTimes: CycleTimes[];
    additionalCosts: AdditionalCost[];
    price: number;
    subComponentIds?: PartSubComponent[];
  }

  interface Part extends Omit<PartFields, 'customer' | 'material'> {
    _id: string;
    customer: Customer;
    material?: Material;
    img?: string;
    createdAt: Date;
    imageIds?: string[];
    documentIds?: string[];
    derived?: PartDerived;
  }

  interface PartCreate extends PartFields {}

  interface PartUpdate extends PartFields {
    _id: string;
    __v?: number;
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

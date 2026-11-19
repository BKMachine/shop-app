declare global {
  interface PartFields {
    customer: string;
    part: string;
    description: string;
    needsReview: boolean;
    stock: number;
    location?: string | null;
    position?: string;
    productLink?: string;
    partFilesPath?: string;
    revision?: string;
    material?: string | null;
    customerSuppliedMaterial?: boolean;
    materialCutType: 'blanks' | 'bars';
    materialLength: number;
    blanksPerPart?: number;
    barLength: number;
    remnantLength: number;
    routing: RoutingOperation[];
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
    hasIncompleteSubComponentCosts?: boolean;
  }

  /** One manufacturing operation on a part's routing, in run order. */
  interface RoutingOperation {
    /**
     * Stable id that stays with the op through reorders, inserts and renumbering; schedule bookings
     * point at it. The server assigns one to new ops, so it is only missing on an unsaved row.
     */
    _id?: string;
    /** Operation number: 10, 20, 30... always sequential by row order. */
    op: number;
    operation: string;
    /** Department `_id`, `'other'`, or null while unassigned (counts as missing data). */
    department: string | null;
    /** Cycle time in minutes; ignored when `noCycleTime` is set. */
    time: number;
    /** Op that is not costed with a cycle time (inspection, deburr, outside process...). */
    noCycleTime?: boolean;
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

  interface PartListResult extends PaginatedResultWithValue<PartListItem> {}

  interface PartListResponse extends PartListResult {}

  interface PartSearchItem {
    _id: string;
    part: string;
    description: string;
  }

  interface PartSearchResponse {
    items: PartSearchItem[];
  }

  interface PartRelationItem {
    part: Part;
    qty: number;
  }

  interface PartRelationResponse {
    items: PartRelationItem[];
  }

  interface PartRelationsResponse {
    subComponents: PartRelationItem[];
    parents: PartRelationItem[];
  }

  interface UpdatePartOptions {
    preserveManagedMediaFields?: boolean;
  }
}

export {};

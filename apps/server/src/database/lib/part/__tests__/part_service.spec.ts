/// <reference types="jest" />

import { jest } from '@jest/globals';

type PartRecord = Part & { __v?: number };
type MaterialRecord = Material & { _id: string };

const partStore = new Map<string, PartRecord>();
const materialStore = new Map<string, MaterialRecord>();
const emit = jest.fn();
const addPartAudit = jest.fn(async () => undefined);
const jestWithEsmMocks = jest as typeof jest & {
  unstable_mockModule: (
    moduleName: string,
    moduleFactory: () => Record<string, unknown>,
  ) => typeof jest;
  unstable_unmockModule: (moduleName: string) => typeof jest;
};

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

function createPartDoc(record: PartRecord) {
  const snapshot = cloneValue(record);

  return {
    ...snapshot,
    populate() {
      return this;
    },
    toObject() {
      return cloneValue(snapshot);
    },
  };
}

class MockPartQuery extends Array<ReturnType<typeof createPartDoc>> {
  private workingRecords: PartRecord[];
  private skipCount = 0;
  private limitCount = Number.POSITIVE_INFINITY;

  static get [Symbol.species](): ArrayConstructor {
    return Array;
  }

  constructor(records: PartRecord[] | number = []) {
    super();
    if (typeof records === 'number') {
      this.workingRecords = [];
      return;
    }

    this.workingRecords = records.map((record) => cloneValue(record));
    this.syncDocs();
  }

  override sort(
    compareFn?:
      | ((a: ReturnType<typeof createPartDoc>, b: ReturnType<typeof createPartDoc>) => number)
      | Record<string, 1 | -1>,
  ): this {
    if (typeof compareFn === 'function' || compareFn === undefined) {
      return super.sort(
        compareFn as
          | ((a: ReturnType<typeof createPartDoc>, b: ReturnType<typeof createPartDoc>) => number)
          | undefined,
      ) as this;
    }

    const [entry] = Object.entries(compareFn);
    if (!entry) return this;

    const [field, direction] = entry;
    this.workingRecords = [...this.workingRecords].sort((left, right) => {
      const leftValue = getNestedValue(left as unknown as Record<string, unknown>, field);
      const rightValue = getNestedValue(right as unknown as Record<string, unknown>, field);

      if (leftValue === rightValue) return 0;
      if (leftValue == null) return 1;
      if (rightValue == null) return -1;

      if (typeof leftValue === 'number' && typeof rightValue === 'number') {
        return leftValue > rightValue ? direction : -direction;
      }

      return (
        String(leftValue).localeCompare(String(rightValue), undefined, {
          numeric: true,
          sensitivity: 'base',
        }) * direction
      );
    });
    this.syncDocs();
    return this;
  }

  skip(value: number): this {
    this.skipCount = value;
    this.syncDocs();
    return this;
  }

  limit(value: number): this {
    this.limitCount = value;
    this.syncDocs();
    return this;
  }

  populate(): this {
    return this;
  }

  lean(): PartRecord[] {
    return this.workingRecords
      .slice(this.skipCount, this.skipCount + this.limitCount)
      .map((record) => cloneValue(record));
  }

  private syncDocs(): void {
    this.length = 0;
    this.push(
      ...this.workingRecords
        .slice(this.skipCount, this.skipCount + this.limitCount)
        .map((record) => createPartDoc(record)),
    );
  }
}

function getNestedValue(record: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => {
    if (!value || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[key];
  }, record);
}

function createPartQuery(records: PartRecord[]) {
  return new MockPartQuery(records);
}

function partMatchesQuery(record: PartRecord, query?: Record<string, unknown>): boolean {
  if (!query) return true;

  const idQuery = query._id as { $in?: string[] } | undefined;
  if (idQuery?.$in) {
    return idQuery.$in.map(String).includes(record._id);
  }

  const parentId = query['subComponentIds.partId'];
  if (typeof parentId === 'string') {
    return (record.subComponentIds ?? []).some((entry) => entry.partId === parentId);
  }

  return true;
}

const PartModelMock = {
  findById: jest.fn((id: string) => {
    const record = partStore.get(String(id));
    return record ? createPartDoc(record) : null;
  }),
  findByIdAndUpdate: jest.fn((id: string, update: Partial<PartRecord>) => {
    const current = partStore.get(String(id));
    if (!current) return null;

    const nextRecord: PartRecord = {
      ...current,
      ...cloneValue(update),
      derived: {
        shopRate: Number(update.derived?.shopRate ?? current.derived?.shopRate) || 0,
        directSubComponentCount:
          Number(
            update.derived?.directSubComponentCount ?? current.derived?.directSubComponentCount,
          ) || 0,
        directParentCount:
          Number(update.derived?.directParentCount ?? current.derived?.directParentCount) || 0,
        hasIncompleteSubComponentCosts: Boolean(
          update.derived?.hasIncompleteSubComponentCosts ??
            current.derived?.hasIncompleteSubComponentCosts,
        ),
      },
    };
    partStore.set(String(id), nextRecord);

    return createPartDoc(nextRecord);
  }),
  updateMany: jest.fn(
    (
      query: Record<string, unknown>,
      update: { $inc?: { 'derived.directParentCount'?: number } },
    ) => {
      const amount = Number(update.$inc?.['derived.directParentCount']) || 0;
      for (const record of partStore.values()) {
        if (!partMatchesQuery(record, query)) continue;
        partStore.set(record._id, {
          ...record,
          derived: {
            shopRate: Number(record.derived?.shopRate) || 0,
            directSubComponentCount: Number(record.derived?.directSubComponentCount) || 0,
            directParentCount: Math.max(0, Number(record.derived?.directParentCount) + amount),
          },
        });
      }

      return { acknowledged: true };
    },
  ),
  find: jest.fn((query?: Record<string, unknown>) => {
    const records = Array.from(partStore.values()).filter((record) =>
      partMatchesQuery(record, query),
    );
    return createPartQuery(records);
  }),
  countDocuments: jest.fn(
    (query?: Record<string, unknown>) =>
      Array.from(partStore.values()).filter((record) => partMatchesQuery(record, query)).length,
  ),
};

const MaterialModelMock = {
  findById: jest.fn((id: string) => ({
    lean: () => {
      const record = materialStore.get(String(id));
      return record ? cloneValue(record) : null;
    },
  })),
};

jestWithEsmMocks.unstable_mockModule('../part_model.js', () => ({
  default: PartModelMock,
}));

jestWithEsmMocks.unstable_mockModule('../../material/material_model.js', () => ({
  default: MaterialModelMock,
}));

jestWithEsmMocks.unstable_mockModule('../../audit/audit_service.js', () => ({
  default: {
    addPartAudit,
  },
}));

jestWithEsmMocks.unstable_mockModule('../../../../server/sockets.js', () => ({
  emit,
}));

async function loadPartService() {
  const module = await import('../part_service.js');
  return module.default;
}

function buildPart(overrides: Partial<PartRecord>): PartRecord {
  return {
    _id: 'part-id',
    customer: 'customer-1' as unknown as Customer,
    part: 'PART',
    description: 'Test part',
    needsReview: false,
    stock: 0,
    materialCutType: 'blanks',
    materialLength: 0,
    barLength: 0,
    remnantLength: 0,
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    cycleTimes: [],
    additionalCosts: [],
    price: 0,
    subComponentIds: [],
    derived: {
      shopRate: 0,
      directSubComponentCount: 0,
      directParentCount: 0,
    },
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  partStore.clear();
  materialStore.clear();
});

test('update refreshes parent derived shop rate when a child part changes', async () => {
  const child = buildPart({
    _id: 'child-1',
    part: 'CHILD-1',
    description: 'Child part',
    price: 50,
    cycleTimes: [{ operation: 'mill', time: 60 }],
    derived: {
      shopRate: 50,
      directSubComponentCount: 0,
      directParentCount: 1,
    },
  });
  const parent = buildPart({
    _id: 'parent-1',
    part: 'PARENT-1',
    description: 'Parent assembly',
    price: 100,
    subComponentIds: [{ partId: 'child-1', qty: 1 }],
    derived: {
      shopRate: 100,
      directSubComponentCount: 1,
      directParentCount: 0,
    },
  });

  partStore.set(child._id, child);
  partStore.set(parent._id, parent);

  const PartService = await loadPartService();
  const updatedPart = await PartService.update(
    {
      ...child,
      cycleTimes: [{ operation: 'mill', time: 30 }],
    },
    'device-1',
  );

  expect(updatedPart?.derived?.shopRate).toBe(100);
  expect(partStore.get('parent-1')?.derived?.shopRate).toBe(200);
  expect(partStore.get('parent-1')?.derived?.directSubComponentCount).toBe(1);
  expect(PartModelMock.findByIdAndUpdate).toHaveBeenCalledWith(
    'parent-1',
    expect.objectContaining({
      derived: expect.objectContaining({
        shopRate: 200,
      }),
    }),
  );
});

test('list sorts parts by price ascending and descending', async () => {
  partStore.set(
    'part-low',
    buildPart({
      _id: 'part-low',
      part: 'LOW',
      description: 'Low price',
      price: 5,
      stock: 3,
    }),
  );
  partStore.set(
    'part-mid',
    buildPart({
      _id: 'part-mid',
      part: 'MID',
      description: 'Mid price',
      price: 15,
      stock: 4,
    }),
  );
  partStore.set(
    'part-high',
    buildPart({
      _id: 'part-high',
      part: 'HIGH',
      description: 'High price',
      price: 25,
      stock: 1,
    }),
  );

  const PartService = await loadPartService();

  const ascending = await PartService.list({ sort: 'price', order: 'asc', limit: 10, offset: 0 });
  const descending = await PartService.list({
    sort: 'price',
    order: 'desc',
    limit: 10,
    offset: 0,
  });

  expect(ascending.items.map((part: PartListItem) => part._id)).toEqual([
    'part-low',
    'part-mid',
    'part-high',
  ]);
  expect(ascending.totalValue).toBe(100);
  expect(descending.items.map((part: PartListItem) => part._id)).toEqual([
    'part-high',
    'part-mid',
    'part-low',
  ]);
  expect(descending.totalValue).toBe(100);
});

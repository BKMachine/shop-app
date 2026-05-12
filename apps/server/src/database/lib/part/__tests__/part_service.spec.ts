/// <reference types="jest" />

import { jest } from '@jest/globals';

type PartRecord = Part & { __v?: number };
type MaterialRecord = Material & { _id: string };

const partStore = new Map<string, PartRecord>();
const materialStore = new Map<string, MaterialRecord>();
const emit = jest.fn();
const addPartAudit = jest.fn(async () => undefined);

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

function createPartQuery(records: PartRecord[]) {
  const docs = records.map(createPartDoc) as Array<ReturnType<typeof createPartDoc>> & {
    populate: () => typeof docs;
    lean: () => PartRecord[];
  };

  docs.populate = () => docs;
  docs.lean = () => records.map((record) => cloneValue(record));

  return docs;
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
        ...current.derived,
        ...cloneValue(update.derived),
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
};

const MaterialModelMock = {
  findById: jest.fn((id: string) => ({
    lean: () => {
      const record = materialStore.get(String(id));
      return record ? cloneValue(record) : null;
    },
  })),
};

jest.unstable_mockModule('../part_model.js', () => ({
  default: PartModelMock,
}));

jest.unstable_mockModule('../../material/material_model.js', () => ({
  default: MaterialModelMock,
}));

jest.unstable_mockModule('../../audit/audit_service.js', () => ({
  default: {
    addPartAudit,
  },
}));

jest.unstable_mockModule('../../../../server/sockets.js', () => ({
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

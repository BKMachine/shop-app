/// <reference types="jest" />

import { jest } from '@jest/globals';

type JobRecord = Job & { __v?: number };
type PartRecord = Pick<Part, '_id' | 'customer' | 'part' | 'description' | 'revision'>;
type CustomerRecord = Customer;

const jobStore = new Map<string, JobRecord>();
const partStore = new Map<string, PartRecord>();
const customerStore = new Map<string, CustomerRecord>();
const emit = jest.fn();
const addJobAudit = jest.fn(async () => undefined);
let nextJobNumber = 1000;
let nextJobId = 1;

const jestWithEsmMocks = jest as typeof jest & {
  unstable_mockModule: (
    moduleName: string,
    moduleFactory: () => Record<string, unknown>,
  ) => typeof jest;
};

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

function createJobDoc(record: JobRecord) {
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

function getNestedValue(record: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => {
    if (!value || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[key];
  }, record);
}

function compareValues(left: unknown, right: unknown, direction: 1 | -1): number {
  if (left === right) return 0;
  if (left == null) return 1;
  if (right == null) return -1;

  if (left instanceof Date && right instanceof Date) {
    return left.getTime() > right.getTime() ? direction : -direction;
  }

  if (typeof left === 'number' && typeof right === 'number') {
    return left > right ? direction : -direction;
  }

  return (
    String(left).localeCompare(String(right), undefined, {
      numeric: true,
      sensitivity: 'base',
    }) * direction
  );
}

class MockJobQuery extends Array<ReturnType<typeof createJobDoc>> {
  private workingRecords: JobRecord[];
  private skipCount = 0;
  private limitCount = Number.POSITIVE_INFINITY;

  static get [Symbol.species](): ArrayConstructor {
    return Array;
  }

  constructor(records: JobRecord[] | number = []) {
    super();
    if (typeof records === 'number') {
      this.workingRecords = [];
      return;
    }

    this.workingRecords = records.map((record) => cloneValue(record));
    this.syncDocs();
  }

  populate(): this {
    return this;
  }

  override sort(
    compareFn?:
      | ((a: ReturnType<typeof createJobDoc>, b: ReturnType<typeof createJobDoc>) => number)
      | Record<string, 1 | -1>,
  ): this {
    if (typeof compareFn === 'function' || compareFn === undefined) {
      return super.sort(
        compareFn as
          | ((a: ReturnType<typeof createJobDoc>, b: ReturnType<typeof createJobDoc>) => number)
          | undefined,
      ) as this;
    }

    const sortEntries = Object.entries(compareFn);
    this.workingRecords = [...this.workingRecords].sort((left, right) => {
      for (const [field, direction] of sortEntries) {
        const result = compareValues(
          getNestedValue(left as unknown as Record<string, unknown>, field),
          getNestedValue(right as unknown as Record<string, unknown>, field),
          direction,
        );
        if (result !== 0) return result;
      }

      return 0;
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

  private syncDocs(): void {
    this.length = 0;
    this.push(
      ...this.workingRecords
        .slice(this.skipCount, this.skipCount + this.limitCount)
        .map((record) => createJobDoc(record)),
    );
  }
}

function matchesRegex(value: unknown, query: { $regex: string; $options: string }): boolean {
  return new RegExp(query.$regex, query.$options).test(String(value ?? ''));
}

function jobMatchesQuery(record: JobRecord, query?: Record<string, unknown>): boolean {
  if (!query) return true;

  for (const [key, value] of Object.entries(query)) {
    if (key === '$or' && Array.isArray(value)) {
      if (!value.some((entry) => jobMatchesQuery(record, entry as Record<string, unknown>))) {
        return false;
      }
      continue;
    }

    if (key === 'dueDate' && value && typeof value === 'object') {
      const dateValue = record.dueDate ? new Date(record.dueDate) : null;
      const min = (value as { $gte?: Date }).$gte;
      const max = (value as { $lte?: Date }).$lte;
      if (min && (!dateValue || dateValue < min)) return false;
      if (max && (!dateValue || dateValue > max)) return false;
      continue;
    }

    const actualValue = getNestedValue(record as unknown as Record<string, unknown>, key);
    if (value && typeof value === 'object' && '$regex' in value) {
      if (!matchesRegex(actualValue, value as { $regex: string; $options: string })) {
        return false;
      }
      continue;
    }

    if (actualValue !== value) return false;
  }

  return true;
}

class MockJobModel {
  _id: string;
  __v = 0;
  jobNumber: number;
  customer: string | Customer;
  part: string | Part;
  qty: number;
  status: JobStatus;
  dueDate?: string | Date | null;
  startedOn?: string | Date | null;
  completedOn?: string | Date | null;
  customerPo?: string;
  priority?: JobPriority;
  notes?: string;
  customerName?: string;
  partNumber?: string;
  partDescription?: string;
  partRevision?: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: Omit<JobRecord, '_id' | 'createdAt' | 'updatedAt'>) {
    this._id = `job-${nextJobId++}`;
    this.jobNumber = data.jobNumber;
    this.customer = data.customer;
    this.part = data.part;
    this.qty = data.qty;
    this.status = data.status;
    this.dueDate = data.dueDate ?? null;
    this.startedOn = data.startedOn ?? null;
    this.completedOn = data.completedOn ?? null;
    this.customerPo = data.customerPo ?? '';
    this.priority = data.priority ?? 'normal';
    this.notes = data.notes ?? '';
    this.customerName = data.customerName ?? '';
    this.partNumber = data.partNumber ?? '';
    this.partDescription = data.partDescription ?? '';
    this.partRevision = data.partRevision ?? '';
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  async save() {
    const record: JobRecord = cloneValue({
      _id: this._id,
      __v: this.__v,
      jobNumber: this.jobNumber,
      customer: this.customer,
      part: this.part,
      qty: this.qty,
      status: this.status,
      dueDate: this.dueDate ?? null,
      startedOn: this.startedOn ?? null,
      completedOn: this.completedOn ?? null,
      customerPo: this.customerPo ?? '',
      priority: this.priority ?? 'normal',
      notes: this.notes ?? '',
      customerName: this.customerName ?? '',
      partNumber: this.partNumber ?? '',
      partDescription: this.partDescription ?? '',
      partRevision: this.partRevision ?? '',
      createdAt: this.createdAt,
      updatedAt: new Date(),
    });
    jobStore.set(record._id, record);
    return createJobDoc(record);
  }

  static find(query?: Record<string, unknown>) {
    const records = Array.from(jobStore.values()).filter((record) =>
      jobMatchesQuery(record, query),
    );
    return new MockJobQuery(records);
  }

  static countDocuments(query?: Record<string, unknown>) {
    return Array.from(jobStore.values()).filter((record) => jobMatchesQuery(record, query)).length;
  }

  static findById(id: string) {
    const record = jobStore.get(String(id));
    return record ? createJobDoc(record) : null;
  }

  static findByIdAndUpdate(id: string, update: Partial<JobRecord>) {
    const current = jobStore.get(String(id));
    if (!current) return null;

    const nextRecord: JobRecord = {
      ...current,
      ...cloneValue(update),
      _id: current._id,
      createdAt: current.createdAt,
      updatedAt: new Date(),
    };
    jobStore.set(current._id, nextRecord);
    return createJobDoc(nextRecord);
  }

  static findByIdAndDelete(id: string) {
    const current = jobStore.get(String(id));
    if (!current) return null;
    jobStore.delete(String(id));
    return createJobDoc(current);
  }
}

const CustomerModelMock = {
  findById: jest.fn((id: string) => {
    const record = customerStore.get(String(id));
    return record ? cloneValue(record) : null;
  }),
};

const PartModelMock = {
  findById: jest.fn((id: string) => {
    const record = partStore.get(String(id));
    return record ? cloneValue(record) : null;
  }),
};

jestWithEsmMocks.unstable_mockModule('../job_model.js', () => ({
  default: MockJobModel,
}));

jestWithEsmMocks.unstable_mockModule('../../customer/customer_model.js', () => ({
  default: CustomerModelMock,
}));

jestWithEsmMocks.unstable_mockModule('../../part/part_model.js', () => ({
  default: PartModelMock,
}));

jestWithEsmMocks.unstable_mockModule('../../sequence/sequence_service.js', () => ({
  default: {
    nextValue: jest.fn(async () => nextJobNumber++),
  },
}));

jestWithEsmMocks.unstable_mockModule('../../audit/audit_service.js', () => ({
  default: {
    addJobAudit,
  },
}));

jestWithEsmMocks.unstable_mockModule('../../../../server/sockets.js', () => ({
  emit,
}));

async function loadJobService() {
  const module = await import('../job_service.js');
  return module;
}

function buildCustomer(overrides: Partial<CustomerRecord> = {}): CustomerRecord {
  return {
    _id: 'customer-1',
    name: 'Acme',
    ...overrides,
  };
}

function buildPart(overrides: Partial<PartRecord> = {}): PartRecord {
  return {
    _id: 'part-1',
    customer: 'customer-1' as unknown as Customer,
    part: 'PART-100',
    description: 'Widget',
    revision: 'A',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jobStore.clear();
  partStore.clear();
  customerStore.clear();
  nextJobNumber = 1000;
  nextJobId = 1;
});

test('create assigns the next job number and copies snapshot fields', async () => {
  customerStore.set('customer-1', buildCustomer());
  partStore.set('part-1', buildPart());

  const { default: JobService } = await loadJobService();
  const job = await JobService.create(
    {
      customer: 'customer-1',
      part: 'part-1',
      qty: 5,
      status: 'open',
      customerPo: 'PO-55',
      priority: 'rush',
      dueDate: new Date('2026-07-20T00:00:00.000Z'),
    },
    'device-1',
  );

  expect(job.jobNumber).toBe(1000);
  expect(job.customerName).toBe('Acme');
  expect(job.partNumber).toBe('PART-100');
  expect(job.partDescription).toBe('Widget');
  expect(job.partRevision).toBe('A');
  expect(addJobAudit).toHaveBeenCalledTimes(1);
  expect(emit).toHaveBeenCalledWith('job', expect.objectContaining({ _id: job._id }));
});

test('create rejects a part that belongs to a different customer', async () => {
  customerStore.set('customer-1', buildCustomer());
  partStore.set(
    'part-1',
    buildPart({
      customer: 'customer-2' as unknown as Customer,
    }),
  );

  const module = await loadJobService();

  await expect(
    module.default.create(
      {
        customer: 'customer-1',
        part: 'part-1',
        qty: 2,
        status: 'open',
      },
      'device-1',
    ),
  ).rejects.toBeInstanceOf(module.JobValidationError);
});

test('update closes a job and auto-fills completedOn when missing', async () => {
  customerStore.set('customer-1', buildCustomer());
  partStore.set('part-1', buildPart());
  jobStore.set('job-1', {
    _id: 'job-1',
    jobNumber: 1001,
    customer: 'customer-1' as unknown as Customer,
    part: 'part-1' as unknown as Part,
    qty: 3,
    status: 'open',
    dueDate: null,
    startedOn: null,
    completedOn: null,
    customerPo: '',
    priority: 'normal',
    notes: '',
    customerName: 'Acme',
    partNumber: 'PART-100',
    partDescription: 'Widget',
    partRevision: 'A',
    createdAt: new Date('2026-07-15T00:00:00.000Z'),
    updatedAt: new Date('2026-07-15T00:00:00.000Z'),
  });

  const { default: JobService } = await loadJobService();
  const updated = await JobService.update(
    {
      _id: 'job-1',
      jobNumber: 1001,
      customer: 'customer-1',
      part: 'part-1',
      qty: 3,
      status: 'closed',
    },
    'device-1',
  );

  expect(updated.status).toBe('closed');
  expect(updated.completedOn).toBeTruthy();
  expect(addJobAudit).toHaveBeenCalledTimes(1);
});

test('update in-process job auto-fills startedOn when missing', async () => {
  customerStore.set('customer-1', buildCustomer());
  partStore.set('part-1', buildPart());
  jobStore.set('job-1', {
    _id: 'job-1',
    jobNumber: 1001,
    customer: 'customer-1' as unknown as Customer,
    part: 'part-1' as unknown as Part,
    qty: 3,
    status: 'open',
    dueDate: null,
    startedOn: null,
    completedOn: null,
    customerPo: '',
    priority: 'normal',
    notes: '',
    customerName: 'Acme',
    partNumber: 'PART-100',
    partDescription: 'Widget',
    partRevision: 'A',
    createdAt: new Date('2026-07-15T00:00:00.000Z'),
    updatedAt: new Date('2026-07-15T00:00:00.000Z'),
  });

  const { default: JobService } = await loadJobService();
  const updated = await JobService.update(
    {
      _id: 'job-1',
      jobNumber: 1001,
      customer: 'customer-1',
      part: 'part-1',
      qty: 3,
      status: 'in_process',
    },
    'device-1',
  );

  expect(updated.status).toBe('in_process');
  expect(updated.startedOn).toBeTruthy();
  expect(addJobAudit).toHaveBeenCalledTimes(1);
});

test('list filters by status and customer', async () => {
  jobStore.set('job-1', {
    _id: 'job-1',
    jobNumber: 1001,
    customer: 'customer-1' as unknown as Customer,
    part: 'part-1' as unknown as Part,
    qty: 3,
    status: 'open',
    dueDate: new Date('2026-07-20T00:00:00.000Z'),
    startedOn: null,
    completedOn: null,
    customerPo: 'PO-1',
    priority: 'normal',
    notes: '',
    customerName: 'Acme',
    partNumber: 'PART-100',
    partDescription: 'Widget',
    partRevision: 'A',
    createdAt: new Date('2026-07-15T00:00:00.000Z'),
    updatedAt: new Date('2026-07-15T00:00:00.000Z'),
  });
  jobStore.set('job-2', {
    _id: 'job-2',
    jobNumber: 1002,
    customer: 'customer-2' as unknown as Customer,
    part: 'part-2' as unknown as Part,
    qty: 1,
    status: 'closed',
    dueDate: new Date('2026-07-22T00:00:00.000Z'),
    startedOn: null,
    completedOn: new Date('2026-07-21T00:00:00.000Z'),
    customerPo: 'PO-2',
    priority: 'rush',
    notes: '',
    customerName: 'Bravo',
    partNumber: 'PART-200',
    partDescription: 'Bracket',
    partRevision: 'B',
    createdAt: new Date('2026-07-15T00:00:00.000Z'),
    updatedAt: new Date('2026-07-15T00:00:00.000Z'),
  });

  const { default: JobService } = await loadJobService();
  const response = await JobService.list({
    customer: 'customer-1',
    status: 'open',
  });

  expect(response.total).toBe(1);
  expect(response.items.map((job) => job._id)).toEqual(['job-1']);
});

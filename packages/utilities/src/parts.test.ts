import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculatePartMaterialCost,
  calculateTotalCycleMinutes,
  hasIncompleteMachineDashboardPartData,
  hasIncompletePartCostData,
  hasMissingRateInputs,
  renumberRouting,
} from './parts.js';

test('calculatePartMaterialCost multiplies blanks cut material cost by blanksPerPart', () => {
  const material = {
    length: 120,
    costPerFoot: 10,
  } as Material;

  const part = {
    materialCutType: 'blanks' as const,
    materialLength: 10,
    blanksPerPart: 2,
    customerSuppliedMaterial: false,
  };

  assert.equal(calculatePartMaterialCost(part, material), (100 / 12 / 12) * 2 * 12);
});

test('calculatePartMaterialCost defaults blanksPerPart to 1 when omitted', () => {
  const material = {
    length: 120,
    costPerFoot: 10,
  } as Material;

  const part = {
    materialCutType: 'blanks' as const,
    materialLength: 10,
    customerSuppliedMaterial: false,
  };

  assert.equal(calculatePartMaterialCost(part, material), 100 / 12);
});

test('calculatePartMaterialCost uses costPerPiece times pieces per part for piece materials', () => {
  const material = {
    kind: 'piece',
    length: null,
    costPerFoot: null,
    costPerPiece: 4.5,
  } as Material;

  const part = {
    materialCutType: 'blanks' as const,
    materialLength: 0,
    blanksPerPart: 2,
    customerSuppliedMaterial: false,
  };

  assert.equal(calculatePartMaterialCost(part, material), 9);
  assert.equal(calculatePartMaterialCost({ ...part, customerSuppliedMaterial: true }, material), 0);
});

test('hasIncompletePartCostData flags priced leaf parts with missing rate inputs', () => {
  const part = {
    price: 125,
    routing: [{ op: 0, operation: 'Op 10', department: 'dept-1', time: 0 }],
    additionalCosts: [],
    material: null,
    customerSuppliedMaterial: false,
    subComponentIds: [],
    derived: {
      directParentCount: 0,
      hasIncompleteSubComponentCosts: false,
    },
  };

  assert.equal(hasIncompletePartCostData(part), true);
  assert.equal(hasIncompleteMachineDashboardPartData(part), true);
});

test('hasIncompletePartCostData flags priced assemblies when derived subcomponent costs are incomplete', () => {
  const part = {
    price: 240,
    routing: [],
    additionalCosts: [],
    material: null,
    customerSuppliedMaterial: false,
    subComponentIds: [{ partId: 'child-1', qty: 1 }],
    derived: {
      directParentCount: 0,
      hasIncompleteSubComponentCosts: true,
    },
  };

  assert.equal(hasIncompletePartCostData(part), true);
  assert.equal(hasIncompleteMachineDashboardPartData(part), true);
});

test('machine dashboard helper flags subcomponents with missing direct inputs even when product price is unset', () => {
  const subComponent = {
    price: 0,
    routing: [{ op: 0, operation: 'Op 10', department: 'dept-1', time: 0 }],
    additionalCosts: [],
    material: null,
    customerSuppliedMaterial: false,
    subComponentIds: [],
    derived: {
      directParentCount: 1,
      hasIncompleteSubComponentCosts: false,
    },
  };

  assert.equal(hasIncompletePartCostData(subComponent), false);
  assert.equal(hasIncompleteMachineDashboardPartData(subComponent), true);
});

test('hasIncompletePartCostData flags top-level parts with no price', () => {
  const topLevelPart = {
    price: 0,
    routing: [{ op: 0, operation: 'Op 10', department: 'dept-1', time: 0 }],
    additionalCosts: [],
    material: null,
    customerSuppliedMaterial: false,
    subComponentIds: [],
    derived: {
      directParentCount: 0,
      hasIncompleteSubComponentCosts: false,
    },
  };

  assert.equal(hasIncompletePartCostData(topLevelPart), true);
  assert.equal(hasIncompleteMachineDashboardPartData(topLevelPart), true);
});

test('hasMissingRateInputs flags cycle rows with a time but no operation name', () => {
  const part = {
    routing: [
      { op: 0, operation: 'Op 10', department: 'dept-1', time: 5 },
      { op: 0, operation: '  ', department: 'dept-1', time: 3 },
    ],
    additionalCosts: [],
    material: 'material-1',
    customerSuppliedMaterial: false,
  };

  assert.equal(hasMissingRateInputs(part), true);
});

test('hasMissingRateInputs flags placeholder cycle rows with no operation name or time', () => {
  const part = {
    routing: [
      { op: 0, operation: 'Op 10', department: 'dept-1', time: 5 },
      { op: 0, operation: '', department: 'dept-1', time: 0 },
    ],
    additionalCosts: [{ cost: 10 }],
    material: 'material-1',
    customerSuppliedMaterial: false,
  };

  assert.equal(hasMissingRateInputs(part), true);
});

test('hasMissingRateInputs passes when every cycle row has an operation name and time', () => {
  const part = {
    routing: [
      { op: 0, operation: 'Op 10', department: 'dept-1', time: 5 },
      { op: 0, operation: 'Op 20', department: 'dept-1', time: 2 },
    ],
    additionalCosts: [],
    material: 'material-1',
    customerSuppliedMaterial: false,
  };

  assert.equal(hasMissingRateInputs(part), false);
});

test('hasMissingRateInputs flags routing rows without a department', () => {
  const part = {
    routing: [
      { op: 10, operation: 'Lathe', department: 'dept-1', time: 5 },
      { op: 20, operation: 'Mill', department: null, time: 2 },
    ],
    additionalCosts: [],
    material: 'material-1',
    customerSuppliedMaterial: false,
  };

  assert.equal(hasMissingRateInputs(part), true);
  assert.equal(
    hasMissingRateInputs({
      ...part,
      routing: part.routing.map((operation) => ({ ...operation, department: 'other' })),
    }),
    false,
  );
});

test('routing rows flagged noCycleTime do not need a time and are not costed', () => {
  const routing = [
    { op: 10, operation: 'Lathe', department: 'dept-1', time: 5 },
    { op: 20, operation: 'Inspect', department: 'other', time: 4, noCycleTime: true },
  ];
  const part = {
    routing,
    additionalCosts: [],
    material: 'material-1',
    customerSuppliedMaterial: false,
  };

  assert.equal(hasMissingRateInputs(part), false);
  assert.equal(
    hasMissingRateInputs({ ...part, routing: routing.map((op) => ({ ...op, time: 0 })) }),
    true,
  );
  assert.equal(calculateTotalCycleMinutes(routing), 5);
});

test('hasMissingRateInputs accepts a routing where every op is explicitly untimed', () => {
  const part = {
    routing: [{ op: 10, operation: 'Inspect', department: 'other', time: 0, noCycleTime: true }],
    additionalCosts: [],
    material: 'material-1',
    customerSuppliedMaterial: false,
  };

  assert.equal(hasMissingRateInputs(part), false);
  // With no routing and no additional cost there is still nothing to cost the part by.
  assert.equal(hasMissingRateInputs({ ...part, routing: [] }), true);
});

test('renumberRouting numbers ops by position in increments of 10', () => {
  const routing = renumberRouting([
    { op: 30, operation: 'C', department: 'other', time: 1 },
    { op: 10, operation: 'A', department: 'other', time: 1 },
    { op: 99, operation: 'B', department: 'other', time: 1 },
  ]);

  assert.deepEqual(
    routing.map(({ op, operation }) => `${op}:${operation}`),
    ['10:C', '20:A', '30:B'],
  );
});

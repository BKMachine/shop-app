import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculatePartMaterialCost,
  hasIncompleteMachineDashboardPartData,
  hasIncompletePartCostData,
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

test('hasIncompletePartCostData flags priced leaf parts with missing rate inputs', () => {
  const part = {
    price: 125,
    cycleTimes: [{ operation: 'Op 10', time: 0 }],
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
    cycleTimes: [],
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
    cycleTimes: [{ operation: 'Op 10', time: 0 }],
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
    cycleTimes: [{ operation: 'Op 10', time: 0 }],
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

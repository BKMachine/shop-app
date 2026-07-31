import assert from 'node:assert/strict';
import test from 'node:test';
import { hasIncompleteMachineDashboardPartData, hasIncompletePartCostData } from './parts.js';

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

test('machine dashboard helper does not flag top-level parts with no price unless shared cost helper does', () => {
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

  assert.equal(hasIncompletePartCostData(topLevelPart), false);
  assert.equal(hasIncompleteMachineDashboardPartData(topLevelPart), false);
});

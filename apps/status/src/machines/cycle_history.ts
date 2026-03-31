const MAX_CYCLE_HISTORY = 20;

export function normalizeCycleHistory(value: MachineLastCycle | undefined): MachineCycleHistory {
  if (Array.isArray(value)) {
    return value.filter((cycle): cycle is number => Number.isFinite(cycle) && cycle > 0);
  }

  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return [value];
  }

  return [];
}

export function appendCycleHistory(
  current: MachineLastCycle | undefined,
  incoming: MachineLastCycle | undefined,
): MachineCycleHistory {
  const nextCycles = normalizeCycleHistory(incoming);
  if (nextCycles.length === 0) {
    return normalizeCycleHistory(current).slice(0, MAX_CYCLE_HISTORY);
  }

  return [...nextCycles, ...normalizeCycleHistory(current)].slice(0, MAX_CYCLE_HISTORY);
}

export function getLatestCycle(value: MachineLastCycle | undefined): number {
  return normalizeCycleHistory(value)[0] ?? 0;
}

import type { MachineDoc } from '../database/lib/machine/machine_model.js';
import { appendCycleHistory } from './cycle_history.js';
import { machineEvents } from './events.js';

/**
 * New values for a machine's state. A finished cycle is given as its time, and is added to the
 * history of recent cycles rather than replacing it.
 */
export type StateChanges<S extends MachineState> = Partial<Omit<S, 'lastCycle'>> & {
  lastCycle?: number;
};

abstract class Machine<S extends MachineState> {
  readonly id: string;
  readonly doc: MachineDoc;
  private state: S;
  private status: MachineStatus;
  /**
   * Whether a wait for the operator is timed from the status leaving yellow. A source that times
   * the wait itself turns this off.
   */
  protected readonly timesOperatorWait: boolean = true;

  constructor(doc: MachineDoc, initialState: S, seedState?: Partial<S>) {
    this.doc = doc;
    this.id = doc._id.toString();
    this.state = { ...initialState, ...seedState };
    this.status = this.deriveStatus(this.state);
  }

  /** Works out the status from the state alone, as it is also called while constructing. */
  protected abstract deriveStatus(state: S): MachineStatus;

  getState(): Readonly<S> {
    return this.state;
  }

  getStatus(): MachineStatus {
    return this.status;
  }

  toJSON(): MachineData {
    const { departmentId, departmentName } = getMachineDepartment(this.doc.department);

    return {
      id: this.id,
      name: this.doc.name,
      displayName: this.doc.displayName || this.doc.name,
      serialNumber: this.doc.serialNumber,
      brand: this.doc.brand,
      source: this.doc.source,
      model: this.doc.model,
      type: this.doc.type,
      paths: this.doc.paths,
      departmentId,
      department: departmentName,
      location: this.doc.location,
      state: this.state,
      status: this.status,
    };
  }

  /** Applies the changes, then brings the status up to date with them. */
  update(changes: StateChanges<S>): void {
    const previousStatus = this.status;
    const previousStateTs = this.state.lastStateTs;

    this.apply(changes);

    const status = this.deriveStatus(this.state);
    if (status === previousStatus) return;
    this.status = status;
    machineEvents.emit('status', { id: this.id, status });

    // Going offline doesn't mean the operator finished, so it isn't a completed wait.
    if (this.timesOperatorWait && previousStatus === 'yellow' && status !== 'offline') {
      const waited = Date.now() - new Date(previousStateTs).valueOf();
      this.apply({ lastOperatorTime: waited } as StateChanges<S>);
    }
  }

  private apply(changes: StateChanges<S>): void {
    const { lastCycle, ...values } = changes;
    const sent: Changes = { ...values };
    let next = { ...this.state, ...values } as S;

    if (lastCycle !== undefined) {
      const history = appendCycleHistory(this.state.lastCycle, lastCycle);
      next = { ...next, lastCycle: history };
      sent.lastCycle = history;
    }

    this.state = next;
    // The running cycle time changes with every message and clients don't show it.
    delete sent.cycle;
    if (Object.keys(sent).length === 0) return;
    machineEvents.emit('change', { id: this.id, changes: sent });
  }
}

function getMachineDepartment(value: MachineDoc['department']): {
  departmentId: string | null;
  departmentName: string;
} {
  if (!value) {
    return { departmentId: null, departmentName: '' };
  }

  if (typeof value === 'string') {
    return { departmentId: null, departmentName: value };
  }

  if ('name' in value && typeof value.name === 'string') {
    return { departmentId: value._id.toString(), departmentName: value.name.trim() };
  }

  return { departmentId: value.toString(), departmentName: '' };
}

export default Machine;

import type { MachineDoc } from '../database/lib/machine/machine_model.js';
import logger from '../logger.js';
import { appendCycleHistory } from './cycle_history.js';
import { machineEvents } from './events.js';

// Operators often leave a machine switched on but unused, and its source keeps reporting it.
const IDLE_OFFLINE_MS = 4 * 60 * 60 * 1000;

/**
 * Whether a machine has sat idle long enough to show as offline. The time is taken from the
 * machine's last state change, which is saved across restarts, so a restart doesn't reset it.
 */
export function isIdleTooLong(status: MachineStatus, lastStateTs: string, now: number): boolean {
  return status === 'idle' && now - new Date(lastStateTs).valueOf() >= IDLE_OFFLINE_MS;
}

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
  /** The state as the source reports it, where `online` means the machine can be reached. */
  private state: S;
  private status: MachineStatus;
  /** Reachable but idle for too long, so clients are shown it as offline. */
  private idleOffline = false;
  /**
   * Whether a wait for the operator is timed from the status leaving yellow. A source that times
   * the wait itself turns this off.
   */
  protected readonly timesOperatorWait: boolean = true;

  constructor(doc: MachineDoc, initialState: S, seedState?: Partial<S>) {
    this.doc = doc;
    this.id = doc._id.toString();
    this.state = { ...initialState, ...seedState };
    this.status = this.currentStatus();
  }

  /** Works out the status from the state alone, as it is also called while constructing. */
  protected abstract deriveStatus(state: S): MachineStatus;

  /** The state as the source reported it, which is what the source compares new values with. */
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
      state: { ...this.state, online: this.shownOnline(), idleOffline: this.idleOffline },
      status: this.status,
    };
  }

  /** Applies the changes, then brings the status up to date with them. */
  update(changes: StateChanges<S>): void {
    const previousStatus = this.status;
    const previousStateTs = this.state.lastStateTs;
    const wasShownOnline = this.shownOnline();
    const wasIdleOffline = this.idleOffline;
    const wasIdle = previousStatus === 'idle' || this.idleOffline;

    const sent = this.apply(changes);
    // Going idle is a change of state, even when what caused it, such as an alarm clearing or a
    // mode change, isn't one the source times from.
    if (!wasIdle && changes.lastStateTs === undefined && this.deriveStatus(this.state) === 'idle') {
      Object.assign(sent, this.apply({ lastStateTs: new Date().toISOString() } as StateChanges<S>));
    }
    const status = this.currentStatus();
    // Clients are only told about reaching the machine when it changes what they show.
    const shownOnline = this.shownOnline();
    if (shownOnline === wasShownOnline) delete sent.online;
    else sent.online = shownOnline;
    if (this.idleOffline !== wasIdleOffline) sent.idleOffline = this.idleOffline;
    this.emitChanges(sent);

    if (status === previousStatus) return;
    this.status = status;
    machineEvents.emit('status', { id: this.id, status });

    // Going offline doesn't mean the operator finished, so it isn't a completed wait.
    if (this.timesOperatorWait && previousStatus === 'yellow' && status !== 'offline') {
      const waited = Date.now() - new Date(previousStateTs).valueOf();
      this.emitChanges(this.apply({ lastOperatorTime: waited } as StateChanges<S>));
    }
  }

  /** Brings the status up to date with the time, as a machine can sit idle without any changes. */
  checkIdle(): void {
    this.update({});
  }

  private currentStatus(): MachineStatus {
    const status = this.deriveStatus(this.state);
    const idleOffline = isIdleTooLong(status, this.state.lastStateTs, Date.now());
    if (idleOffline && !this.idleOffline) {
      logger.info(`Machine '${this.doc.name}' has been idle for 4 hours, showing offline`);
    }
    this.idleOffline = idleOffline;
    return idleOffline ? 'offline' : status;
  }

  private shownOnline(): boolean {
    return this.state.online && !this.idleOffline;
  }

  /** Applies the changes to the state, returning them as they are sent to clients. */
  private apply(changes: StateChanges<S>): Changes {
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
    return sent;
  }

  private emitChanges(sent: Changes): void {
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

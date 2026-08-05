import { baseUrl } from '../config.js';
import type { MachineDoc } from '../database/lib/machine/machine_model.js';
import { emit } from '../server/socket.io.js';
import { appendCycleHistory } from './cycle_history.js';

class Machine {
  readonly doc: MachineDoc;
  private readonly logo: string;
  private state: MachineState;
  private status: MachineStatus = 'offline';

  constructor(doc: MachineDoc, state: MachineState) {
    this.doc = doc;
    this.logo = `${baseUrl}/img/machine_logos/${this.doc.brand}.png`;
    this.state = state;
  }

  getMachine(): MachineData {
    const displayName = this.doc.displayName || this.doc.name;
    const { departmentId, departmentName } = getMachineDepartment(this.doc.department);

    return {
      id: this.doc._id.toString(),
      name: this.doc.name,
      displayName,
      serialNumber: this.doc.serialNumber,
      brand: this.doc.brand,
      source: this.doc.source,
      model: this.doc.model,
      type: this.doc.type,
      paths: this.doc.paths,
      departmentId,
      department: departmentName,
      location: this.doc.location,
      logo: this.logo,
      state: this.state,
      status: this.status,
    };
  }

  getState() {
    return this.state;
  }

  setState(changes: Changes) {
    const changeObj = Object.fromEntries(changes) as Partial<Record<MachineStateKey, unknown>>;
    const nextState = Object.assign({}, this.getState(), changeObj) as MachineState;

    if ('lastCycle' in changeObj) {
      const currentLastCycle = (this.getState() as MachineState & { lastCycle?: MachineLastCycle })
        .lastCycle;
      const incomingLastCycle = changeObj.lastCycle as MachineLastCycle | undefined;
      const cycleHistory = appendCycleHistory(currentLastCycle, incomingLastCycle);

      (nextState as MachineState & { lastCycle: MachineCycleHistory }).lastCycle = cycleHistory;
      changeObj.lastCycle = cycleHistory;
    }

    this.state = nextState;
    // Remove cycle property before sending changes over websocket
    delete changeObj.cycle;
    if (Object.keys(changeObj).length === 0) return;
    emit('change', { id: this.doc._id.toString(), changes: changeObj });
  }

  getStatus() {
    return this.status;
  }

  setStatus(status: MachineStatus): void {
    if (status !== this.status) {
      this.status = status;
      emit('status', { id: this.doc._id, status: this.status });
    }
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

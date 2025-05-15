import type { MachineDoc } from '../../database/lib/machine/machine_model.js';
import Machine from '../Machine.js';

const initState: HaasState = {
  online: false,
  mode: null,
  execution: null,
  lastCycle: 0,
  lastOperatorTime: 0,
  lastStateTs: new Date().toISOString(),
  serial: '',
};

class HaasMachine extends Machine {
  constructor(doc: MachineDoc) {
    super(doc, { ...initState });
  }

  updateStatus(): void {
    const state = this.getState() as HaasState;
    let status: MachineStatus;
    if (!state.online) status = 'offline';
    else if (state.execution === 'ALARMON') status = 'red';
    else if (state.execution === 'BUSY') status = 'green';
    else if (state.mode === 'MEM' && state.execution === 'IDLE') status = 'yellow';
    else status = 'idle';
    this.setStatus(status);
  }
}

export default HaasMachine;

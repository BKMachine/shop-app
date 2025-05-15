import type { MachineDoc } from '../../database/lib/machine/machine_model.js';
import Machine from '../Machine.js';

const initState: MTConnectState = {
  online: false,
  eStop: 'UNAVAILABLE',
  mode: 'UNAVAILABLE',
  execution: 'UNAVAILABLE',
  program: '',
  motion: 'UNAVAILABLE',
  lastCycle: 0,
  lastOperatorTime: 0,
  lastStateTs: new Date().toISOString(),
};

class MTConnectMachine extends Machine {
  constructor(doc: MachineDoc) {
    super(doc, { ...initState });
  }

  updateStatus(): void {
    const state = this.getState() as MTConnectState;
    let status: MachineStatus;
    if (!state.online) status = 'offline';
    else if (state.eStop === 'TRIGGERED') status = 'red';
    else if (state.execution === 'ACTIVE') status = 'green';
    else if (state.mode === 'AUTOMATIC' && state.execution === 'READY') status = 'yellow';
    else status = 'idle';
    this.setStatus(status);
  }
}

export default MTConnectMachine;

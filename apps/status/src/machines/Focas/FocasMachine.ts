import type { MachineDoc } from '../../database/lib/machine/machine_model.js';
import Machine from '../Machine.js';

const initState: FocasState = {
  online: false,
  mainProgram: '',
  mainComment: '',
  runningProgram: '',
  runningComment: '',
  mode: 'UNAVAILABLE',
  execution: 'UNAVAILABLE',
  alarms: {},
  mode2: 'UNAVAILABLE',
  execution2: 'UNAVAILABLE',
  alarms2: {},
  cycle: 0,
  macro_timer: 0,
  lastCycle: 0,
  lastOperatorTime: 0,
  lastStateTs: new Date().toISOString(),
};

class FocasMachine extends Machine {
  constructor(doc: MachineDoc) {
    super(doc, { ...initState });
  }

  updateStatus(): void {
    const state = this.getState() as FocasState;
    let status: MachineStatus;
    const alarms = Object.assign({}, state.alarms, state.alarms2);
    state;
    if (!state.online) status = 'offline';
    else if (Object.keys(alarms).length > 0) status = 'red';
    else if (state.execution === 'ACTIVE' || state.execution2 === 'ACTIVE') status = 'green';
    else if (
      (state.mode === 'AUTOMATIC' && state.execution === 'READY') ||
      (state.mode2 === 'AUTOMATIC' && state.execution2 === 'READY')
    )
      status = 'yellow';
    else status = 'idle';
    this.setStatus(status);
  }
}

export default FocasMachine;

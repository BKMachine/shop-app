import type { MachineDoc } from '../../database/lib/machine/machine_model.js';
import Machine from '../Machine.js';

const initState: ArduinoState = {
  online: false,
  green: false,
  yellow: false,
  red: false,
  cycle: 0,
  lastCycle: 0,
  lastOperatorTime: 0,
  lastStateTs: new Date().toISOString(),
};

class ArduinoMachine extends Machine {
  constructor(doc: MachineDoc) {
    super(doc, { ...initState });
  }

  updateStatus(): void {
    const state = this.getState() as ArduinoState;
    let status: MachineStatus;
    if (!state.online) status = 'offline';
    else if (state.red) status = 'red';
    else if (state.green) status = 'green';
    else if (state.yellow) status = 'yellow';
    else status = 'idle';
    this.setStatus(status);
  }
}

export default ArduinoMachine;

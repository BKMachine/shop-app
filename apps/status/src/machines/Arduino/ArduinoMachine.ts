import type { MachineDoc } from '../../database/lib/machine/machine_model.js';
import Machine from '../Machine.js';

function initialState(): ArduinoState {
  return {
    online: false,
    green: false,
    yellow: false,
    red: false,
    cycle: 0,
    lastCycle: [],
    lastOperatorTime: 0,
    lastStateTs: new Date().toISOString(),
  };
}

class ArduinoMachine extends Machine<ArduinoState> {
  // The polling times the wait from the yellow light itself, which can be lit under another light.
  protected override readonly timesOperatorWait = false;

  constructor(doc: MachineDoc, seedState?: Partial<ArduinoState>) {
    super(doc, initialState(), seedState);
  }

  protected deriveStatus(state: ArduinoState): MachineStatus {
    if (!state.online) return 'offline';
    if (state.red) return 'red';
    if (state.green) return 'green';
    if (state.yellow) return 'yellow';
    return 'idle';
  }
}

export default ArduinoMachine;

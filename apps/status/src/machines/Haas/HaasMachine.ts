import type { MachineDoc } from '../../database/lib/machine/machine_model.js';
import Machine from '../Machine.js';

function initialState(): HaasState {
  return {
    online: false,
    mode: null,
    execution: null,
    lastCycle: [],
    lastOperatorTime: 0,
    lastStateTs: new Date().toISOString(),
  };
}

class HaasMachine extends Machine<HaasState> {
  constructor(doc: MachineDoc, seedState?: Partial<HaasState>) {
    super(doc, initialState(), seedState);
  }

  protected deriveStatus(state: HaasState): MachineStatus {
    if (!state.online) return 'offline';
    if (state.execution === 'ALARMON') return 'red';
    if (state.execution === 'BUSY') return 'green';
    if (state.mode === 'MEM' && state.execution === 'IDLE') return 'yellow';
    return 'idle';
  }
}

export default HaasMachine;

import type { MachineDoc } from '../../database/lib/machine/machine_model.js';
import Machine from '../Machine.js';

function initialState(): MTConnectState {
  return {
    online: false,
    eStop: 'UNAVAILABLE',
    mode: 'UNAVAILABLE',
    execution: 'UNAVAILABLE',
    program: '',
    motion: 'UNAVAILABLE',
    alarms: [],
    lastCycle: [],
    lastOperatorTime: 0,
    lastStateTs: new Date().toISOString(),
  };
}

class MTConnectMachine extends Machine<MTConnectState> {
  constructor(doc: MachineDoc, seedState?: Partial<MTConnectState>) {
    super(doc, initialState(), seedState);
  }

  protected deriveStatus(state: MTConnectState): MachineStatus {
    if (!state.online) return 'offline';
    if (state.eStop === 'TRIGGERED') return 'red';
    // A warning, such as the motion warning at the start of each cycle, doesn't stop the machine.
    if (state.motion === 'FAULT' || state.alarms.some((alarm) => alarm.level === 'FAULT')) {
      return 'red';
    }
    if (state.execution === 'ACTIVE') return 'green';
    if (state.mode === 'AUTOMATIC' && state.execution === 'READY') return 'yellow';
    return 'idle';
  }
}

export default MTConnectMachine;

import type { MachineDoc } from '../../database/lib/machine/machine_model.js';
import Machine from '../Machine.js';

function initialState(): FocasState {
  return {
    online: false,
    mainProgram: '',
    mainComment: '',
    runningProgram: '',
    runningComment: '',
    mode: 'UNAVAILABLE',
    execution: 'UNAVAILABLE',
    alarms: {},
    rapid: 0,
    mode2: 'UNAVAILABLE',
    execution2: 'UNAVAILABLE',
    alarms2: {},
    rapid2: 0,
    cycle: 0,
    macro_timer: 0,
    lastCycle: [],
    lastOperatorTime: 0,
    lastStateTs: new Date().toISOString(),
  };
}

class FocasMachine extends Machine<FocasState> {
  constructor(doc: MachineDoc, seedState?: Partial<FocasState>) {
    super(doc, initialState(), seedState);
  }

  protected deriveStatus(state: FocasState): MachineStatus {
    const hasAlarm = Object.keys({ ...state.alarms, ...state.alarms2 }).length > 0;
    if (!state.online) return 'offline';
    if (hasAlarm) return 'red';
    if (state.execution === 'ACTIVE' || state.execution2 === 'ACTIVE') return 'green';
    if (
      (state.mode === 'AUTOMATIC' && state.execution === 'READY') ||
      (state.mode2 === 'AUTOMATIC' && state.execution2 === 'READY')
    ) {
      return 'yellow';
    }
    return 'idle';
  }
}

export default FocasMachine;

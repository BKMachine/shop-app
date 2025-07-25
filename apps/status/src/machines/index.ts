import Machine from '../database/lib/machine/index.js';
import { emit } from '../server/socket.io.js';
import ArduinoMachine from './Arduino/ArduinoMachine.js';
import FocasMachine from './Focas/FocasMachine.js';
import HaasMachine from './Haas/HaasMachine.js';
import MTConnectMachine from './MTConnect/MTConnectMachine.js';

const machines = new Map<string, FocasMachine | ArduinoMachine | MTConnectMachine | HaasMachine>();
export const focasMachines = new Map<string, FocasMachine>();
export const arduinoMachines = new Map<string, ArduinoMachine>();
export const mtConnectMachines = new Map<string, MTConnectMachine>();
export const haasMachines = new Map<string, HaasMachine>();

export function initMachines(): Promise<void> {
  return new Promise((resolve) => {
    (async () => {
      const machineDocs = await Machine.list();
      machines.clear();
      focasMachines.clear();
      arduinoMachines.clear();
      mtConnectMachines.clear();
      haasMachines.clear();
      machineDocs.forEach((doc: any) => {
        if (doc.source === 'focas') {
          const machine = new FocasMachine(doc);
          machines.set(machine.doc._id.toString(), machine);
          focasMachines.set(doc.location, machine);
        } else if (doc.source === 'arduino') {
          const machine = new ArduinoMachine(doc);
          machines.set(machine.doc._id.toString(), machine);
          arduinoMachines.set(doc.location, machine);
        } else if (doc.source === 'mtconnect') {
          const machine = new MTConnectMachine(doc);
          machines.set(machine.doc._id.toString(), machine);
          mtConnectMachines.set(doc.location, machine);
        } else if (doc.source === 'serial') {
          const machine = new HaasMachine(doc);
          machines.set(machine.doc._id.toString(), machine);
          haasMachines.set(doc.location, machine);
        }
      });
      emit('refresh-data');
      resolve();
    })();
  });
}

export default machines;

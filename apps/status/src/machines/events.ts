import { EventEmitter } from 'node:events';

interface MachineEvents {
  change: [{ id: string; changes: Changes }];
  status: [{ id: string; status: MachineStatus }];
  /** The set of machines or their details changed, so clients should fetch them again. */
  'refresh-data': [];
}

/** What machines report as they change. The socket server passes these on to clients. */
export const machineEvents = new EventEmitter<MachineEvents>();

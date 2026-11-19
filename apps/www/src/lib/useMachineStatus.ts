import { io } from 'socket.io-client';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { statusApi } from '@/plugins/axios';

/** How long a machine is red before its status starts flashing, as on the status tiles. */
const RED_FLASH_AFTER_MS = 15 * 60 * 1000;

export type MachineStatusTone =
  | 'green'
  | 'yellow'
  | 'red'
  | 'red-flash'
  | 'idle'
  | 'offline'
  | 'none';

/**
 * The colour a machine's status shows, matching the status tiles: offline, or while online
 * green, yellow, red (flashing once it has been red for 15 minutes) or idle for anything else.
 * `none` is a machine the status service doesn't report.
 */
export function machineStatusTone(machine: MachineInfo | undefined, now: Date): MachineStatusTone {
  if (!machine) return 'none';
  if (!machine.state.online) return 'offline';
  if (machine.status === 'green' || machine.status === 'yellow') return machine.status;
  if (machine.status !== 'red') return 'idle';
  const since = new Date(machine.state.lastStateTs).valueOf();
  return now.valueOf() - since >= RED_FLASH_AFTER_MS ? 'red-flash' : 'red';
}

/**
 * Live machine status from the status service, kept current over its socket. Connects while the
 * calling component is mounted, and only when `enabled` is true at mount.
 */
export function useMachineStatus(enabled: () => boolean) {
  const machines = ref(new Map<string, MachineInfo>());

  const statusSocket = io(import.meta.env.VITE_STATUS_API_URL, {
    transports: ['websocket', 'polling'],
    autoConnect: false,
  });

  async function refresh() {
    try {
      const { data } = await statusApi.get<MachineInfo[]>('/machines');
      machines.value = new Map(data.map((machine) => [machine.id, machine]));
    } catch (error) {
      console.error('Error fetching machine status:', error);
    }
  }

  statusSocket.io.on('reconnect', () => void refresh());
  statusSocket.on('refresh-data', () => void refresh());
  statusSocket.on('change', ({ id, changes }: { id: string; changes: Changes }) => {
    const machine = machines.value.get(id);
    if (machine) machine.state = Object.assign({}, machine.state, changes);
  });
  statusSocket.on('status', ({ id, status }: { id: string; status: MachineStatus }) => {
    const machine = machines.value.get(id);
    if (machine) machine.status = status;
  });

  onMounted(() => {
    if (!enabled()) return;
    void refresh();
    statusSocket.connect();
  });

  onBeforeUnmount(() => {
    statusSocket.disconnect();
  });

  return { machines, refresh };
}

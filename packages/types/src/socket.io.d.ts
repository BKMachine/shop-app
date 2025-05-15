interface ServerToClientEvents {
  refresh: () => void;
  change: (status: { id: string; changes: Changes }) => void;
  status: (status: { id: string; status: MachineStatus }) => void;
  'refresh-data': () => void;
}

type EmitterEventNames = keyof ServerToClientEvents;

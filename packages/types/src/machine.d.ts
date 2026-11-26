declare global {
  type MachineCycleHistory = number[];
  type MachineLastCycle = number | MachineCycleHistory;

  interface FocasState {
    online: boolean;
    /** Shown offline because it has sat idle for 4 hours, although the source can reach it. */
    idleOffline?: boolean;
    mainProgram: string;
    mainComment: string;
    runningProgram: string;
    runningComment: string;
    mode: Mode;
    execution: Execution;
    alarms: Alarm;
    rapid: number;
    mode2: Mode;
    execution2: Execution;
    alarms2: Alarm;
    rapid2: number;
    cycle: number;
    macro_timer: number;
    lastCycle: MachineLastCycle;
    lastOperatorTime: number;
    lastStateTs: string;
  }

  type Mode = 'AUTOMATIC' | 'EDIT' | 'MANUAL' | 'MANUAL_DATA_INPUT' | 'UNAVAILABLE';
  type Execution =
    | 'ACTIVE'
    | 'FEED_HOLD'
    | 'INTERRUPTED'
    | 'OPTIONAL_STOP'
    | 'PROGRAM_STOPPED'
    | 'READY'
    | 'STOPPED'
    | 'UNAVAILABLE';

  interface Alarm {
    [key: string]: {
      path: number;
      axis_code: number;
      axis: string;
      number: number;
      message: string;
      type_code: number;
      type: string;
      id: string;
      is_triggered: boolean;
    };
  }

  interface FocasMapping {
    [key: string]: {
      [key: string]: string;
    };
  }

  interface ArduinoState {
    online: boolean;
    /** Shown offline because it has sat idle for 4 hours, although the source can reach it. */
    idleOffline?: boolean;
    green: boolean;
    yellow: boolean;
    red: boolean;
    cycle: number;
    lastCycle: MachineLastCycle;
    lastOperatorTime: number;
    lastStateTs: string;
  }

  interface ArduinoResponse {
    green: boolean;
    yellow: boolean;
    red: boolean;
    /** Times green has come on since the board started. Older firmware doesn't send the counters. */
    greenStarts?: number;
    /** Milliseconds green has been on since the board started. */
    greenMs?: number;
    /** Milliseconds since the board started. Going backwards means it restarted. */
    uptimeMs?: number;
  }

  interface MTConnectState {
    online: boolean;
    /** Shown offline because it has sat idle for 4 hours, although the source can reach it. */
    idleOffline?: boolean;
    eStop: 'UNAVAILABLE' | 'ARMED' | 'TRIGGERED';
    mode: Mode;
    execution: Execution;
    program: string;
    motion: 'UNAVAILABLE' | 'NORMAL' | 'WARNING' | 'FAULT';
    /** Active alarm conditions, faults first. */
    alarms: MTConnectAlarm[];
    lastCycle: MachineLastCycle;
    lastOperatorTime: number;
    lastStateTs: string;
  }

  interface MTConnectAlarm {
    /** The condition's data item type, such as LOGIC_PROGRAM or MOTION. */
    type: string;
    level: 'FAULT' | 'WARNING';
    /** The control's alarm number, or '' when the adapter doesn't send one. */
    code: string;
    /** The alarm text, or '' when the adapter doesn't send one. */
    message: string;
  }

  interface MTConnectMappings {
    [key: string]: string;
  }

  interface HaasState {
    online: boolean;
    /** Shown offline because it has sat idle for 4 hours, although the source can reach it. */
    idleOffline?: boolean;
    mode: HaasMode;
    execution: HaasExecution;
    lastCycle: MachineLastCycle;
    lastOperatorTime: number;
    lastStateTs: string;
  }

  type HaasCommand = 'MODE' | 'PROGRAM' | 'PREVCYCLE' | 'STATUS' | 'LASTCYCLE';
  type HaasMode = null | 'ZERORET' | 'MEM' | 'EDIT' | 'JOG' | 'MDI';
  type HaasExecution = null | 'ALARMON' | 'IDLE' | 'FEEDHOLD' | 'BUSY';

  type MachineState = FocasState | ArduinoState | MTConnectState | HaasState;
  type MachineStateKey =
    | keyof FocasState
    | keyof ArduinoState
    | keyof MTConnectState
    | keyof HaasState;

  /** The state values that changed, as sent to status board clients. */
  type Changes = Partial<Record<MachineStateKey, unknown>>;

  type MachineBrand = 'fanuc' | 'mori' | 'doosan' | 'mitsubishi' | 'haas' | 'mazak' | 'hanwha';
  type MachineType = 'lathe' | 'mill' | 'swiss';
  type MachineSource = 'focas' | 'arduino' | 'mtconnect' | 'serial';
  type MachineStatus = 'offline' | 'red' | 'yellow' | 'green' | 'idle';

  interface MachineJobSummary {
    jobId?: string | null;
    jobNumber?: number | null;
    partId?: string | null;
    partNumber?: string | null;
    partSummary?: string | null;
    partHasIncompleteData?: boolean;
  }

  /** A machine as it is set up in the database, without any live data. */
  interface MachineConfig {
    id: string;
    name: string;
    displayName: string;
    serialNumber: string;
    brand: MachineBrand;
    model: string;
    type: MachineType;
    source: MachineSource;
    paths: '1' | '2';
    departmentId?: string | null;
    department: string;
    location: string;
  }

  interface MachineData extends MachineConfig {
    status: MachineStatus;
    state: MachineState;
    jobId?: string | null;
    jobNumber?: number | null;
    /** Every in-process job on the machine, newest task first (includes the primary job). */
    jobs?: MachineJobSummary[];
    partId?: string | null;
    partNumber?: string | null;
    partDescription?: string | null;
    partHasIncompleteData?: boolean;
    partHourlyRate?: number | null;
    partSummary?: string | null;
    /** A job running on the machine is not the one the schedule has on it today. */
    scheduleMismatch?: boolean;
    /** The job booked on the machine for today, for explaining a mismatch. */
    scheduledJobNumber?: number | null;
    index?: number;
  }

  interface Focas extends MachineData {
    source: 'focas';
    state: FocasState;
    paths: '1' | '2';
  }

  interface Arduino extends MachineData {
    source: 'arduino';
    state: ArduinoState;
    paths: '1';
  }

  interface MTConnect extends MachineData {
    source: 'mtconnect';
    state: MTConnectState;
    paths: '1';
  }

  interface Haas extends MachineData {
    source: 'serial';
    state: HaasState;
    paths: '1';
  }

  type MachineInfo = Focas | Arduino | MTConnect | Haas;

  interface BlankMachineTile {
    blank: true;
    index: number;
    id: string;
  }

  type QCode = 100 | 101 | 102 | 104 | 200 | 201 | 300 | 301 | 303 | 304 | 402 | 403 | 500 | 600;
}

export {};

declare global {
  interface MTConnectResponse {
    MTConnectStreams: {
      jsonVersion: number;
      schemaVersion: string;
      Header: {
        version: string;
        creationTime: string;
        testIndicator: boolean;
        instanceId: number;
        sender: string;
        schemaVersion: string;
        deviceModelChangeTime: string;
        bufferSize: number;
        nextSequence: number;
        lastSequence: number;
        firstSequence: number;
      };
      Streams: { DeviceStream: [DeviceStream] };
    };
  }

  interface DeviceStream {
    name: string;
    uuid: string;
    ComponentStream: [Component];
  }

  interface Component {
    component: string;
    componentId: string;
    name: string;
    Events: {
      AssetChanged: [Event];
      AssetCountDataSet: [Event];
      AssetRemoved: [Event];
      Availability: [Event];
      EmergencyStop: [Event];
      Execution: [Event];
      Mode: [Event];
      Motion: [Event];
      Program: [Event];
    };
    /** Alarm conditions, grouped by level. Each item reports the level it is at now. */
    Condition?: Partial<Record<ConditionLevel, ConditionEntry[]>>;
  }

  interface Event {
    value: string;
    assetType: string;
    dataItemId: string;
    sequence: number;
    timestamp: string;
  }

  type ConditionLevel = 'Normal' | 'Warning' | 'Fault' | 'Unavailable';

  interface ConditionEntry {
    /** The alarm text, when the adapter sends one. */
    value?: string;
    dataItemId: string;
    name?: string;
    /** The data item type, such as LOGIC_PROGRAM or MOTION. */
    type: string;
    /** The control's own alarm number. */
    nativeCode?: string;
    nativeSeverity?: string;
    qualifier?: string;
    sequence: number;
    timestamp: string;
  }
}

export {};

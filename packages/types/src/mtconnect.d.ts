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
}

interface Event {
  value: string;
  assetType: string;
  dataItemId: string;
  sequence: number;
  timestamp: string;
}

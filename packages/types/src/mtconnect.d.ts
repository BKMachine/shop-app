interface MTConnectResponse {
  MTConnectStreams: {
    Streams: {
      DeviceStream: DeviceStream[];
    };
  };
}

interface DeviceStream {
  '@_name': string;
  '@_uuid': string;
  ComponentStream: ComponentStream | ComponentStream[];
}

interface ComponentStream {
  Events?: Event;
}

interface Event {
  Availability?: {
    '@_text': 'UNAVAILABLE' | 'AVAILABLE';
  };
  EmergencyStop?: {
    '@_text': 'UNAVAILABLE' | 'ARMED' | 'TRIGGERED';
  };
  Mode?: {
    '@_text': 'AUTOMATIC' | string;
  };
  Execution?: {
    '@_text': 'READY' | string;
  };
  Program?: {
    '@_text': string;
  };
  Motion?: {
    '@_text': 'NORMAL' | 'WARNING' | 'FAULT';
  };
}

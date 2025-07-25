interface PerformanceResponse {
  hits: {
    total: {
      value: number;
    };
    hits: Performance[];
  };
}

interface Performance {
  _source: {
    '@timestamp': string;
    running: number;
    notRunning: number;
    percent: number;
    machineCount: number;
  };
}

interface StatsResponse {
  hits: {
    total: {
      value: number;
    };
  };
}

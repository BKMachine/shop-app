import path from 'node:path';

export const dataDir = path.join(process.cwd(), 'data');
export const logDir = path.join(process.cwd(), 'logs');
export const machineStateCacheFile = path.join(dataDir, 'machine-state-cache.json');

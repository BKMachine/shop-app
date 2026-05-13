import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const mongodbUri = process.env.MONGO_URL;

if (!mongodbUri) {
  console.error('MONGODB_URI is not set. Add it to apps/server/.env.');
  process.exit(1);
}

mkdirSync('./backups', { recursive: true });

const timestamp = new Date()
  .toISOString()
  .replace('T', '-')
  .replace(/\..+/, '')
  .replaceAll(':', '-');

const result = spawnSync(
  'mongodump',
  [`--uri=${mongodbUri}`, `--archive=./backups/dump-${timestamp}.gz`, '--gzip'],
  { stdio: 'inherit' },
);

process.exit(result.status ?? 1);

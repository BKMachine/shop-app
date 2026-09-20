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

if (result.error) {
  if ('code' in result.error && result.error.code === 'ENOENT') {
    console.error(
      'mongodump was not found on PATH. Install the MongoDB Database Tools ' +
        '(mongodb-database-tools) and make sure `mongodump` is available, then try again.',
    );
  } else {
    console.error('Failed to run mongodump:', result.error.message);
  }
  process.exit(1);
}

process.exit(result.status ?? 1);

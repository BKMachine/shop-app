import { connect, disconnect } from '../src/database/index.js';
import { migratePartRoutingFromCycleTimes } from '../src/database/lib/part/part_service.js';

// The server also runs this on start; this is for running it by hand against a database.
async function main() {
  await connect();
  const count = await migratePartRoutingFromCycleTimes();
  console.log(`Converted cycle times to routing for ${count} parts.`);
  await disconnect();
}

main().catch((error) => {
  console.error(error);
});

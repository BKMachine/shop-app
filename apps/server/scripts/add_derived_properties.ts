import { connect, disconnect } from '../src/database/index.js';
import { refreshAllStoredDerivedProperties } from '../src/database/lib/part/part_service.js';

async function main() {
  await connect();
  const count = await refreshAllStoredDerivedProperties();
  console.log(`Calculated derived properties for ${count} parts.`);
  await disconnect();
}

main().catch((error) => {
  console.error(error);
});

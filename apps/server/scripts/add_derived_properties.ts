import { connect, disconnect } from '../src/database/index.js';
import Part from '../src/database/lib/part/part_model.js';
import { calculateDerivedPartProperties } from '../src/database/lib/part/part_service.js';

async function main() {
  await connect();

  const parts = await Part.find();
  console.log(`Calculating derived properties for ${parts.length} parts...`);
  for (const part of parts) {
    calculateDerivedPartProperties(part);
    await part.save();
  }
  await disconnect();
}

main().catch((error) => {
  console.error(error);
});

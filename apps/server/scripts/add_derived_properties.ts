import { connect, disconnect } from '../src/database/index.js';
import Part from '../src/database/lib/part/part_model.js';
import { calculateDerivedPartProperties } from '../src/database/lib/part/part_service.js';

async function main() {
  await connect();

  const parts = await Part.find();
  console.log(`Calculating derived properties for ${parts.length} parts...`);
  const directParentCountByPartId = new Map<string, number>();

  for (const part of parts) {
    for (const subComponent of part.subComponentIds || []) {
      const partId = String(subComponent.partId);
      directParentCountByPartId.set(partId, (directParentCountByPartId.get(partId) || 0) + 1);
    }
  }

  for (const part of parts) {
    part.derived = {
      ...part.derived,
      shopRate: 0,
      directSubComponentCount: 0,
      directParentCount: directParentCountByPartId.get(part._id.toString()) || 0,
    };
    await calculateDerivedPartProperties(part);
    await part.save();
  }
  await disconnect();
}

main().catch((error) => {
  console.error(error);
});

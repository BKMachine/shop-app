import { emit } from '../../../server/sockets.js';
import Audit from '../audit/audit_service.js';
import Part from './part_model.js';

function normalizeSubComponentIds(subComponentIds: unknown): PartSubComponent[] {
  if (!Array.isArray(subComponentIds)) {
    return [];
  }

  const normalized = subComponentIds.map((entry) => {
    if (typeof entry === 'string') {
      return { partId: entry, qty: 1 };
    }

    if (entry && typeof entry === 'object' && 'partId' in entry) {
      return {
        partId: String(entry.partId),
        qty: Math.max(1, Number(entry.qty) || 1),
      };
    }

    return {
      partId: String(entry),
      qty: 1,
    };
  });

  return normalized.filter(
    (entry, index, array) =>
      array.findIndex((candidate) => candidate.partId === entry.partId) === index,
  );
}

async function validateSubComponentIds(subComponentIds: PartSubComponent[], partId?: string) {
  if (!partId) {
    return subComponentIds;
  }

  if (subComponentIds.some((entry) => entry.partId === partId)) {
    throw new Error('A part cannot include itself as a sub-component.');
  }

  const parts = await Part.find({}, { _id: 1, subComponentIds: 1 }).lean();
  const dependencyMap = new Map(
    parts.map((part) => [
      String(part._id),
      normalizeSubComponentIds(part.subComponentIds).map((entry) => entry.partId),
    ]),
  );

  const dependsOn = (
    candidateId: string,
    targetId: string,
    visited = new Set<string>(),
  ): boolean => {
    if (visited.has(candidateId)) {
      return false;
    }

    const nextVisited = new Set(visited);
    nextVisited.add(candidateId);

    return (dependencyMap.get(candidateId) || []).some((subComponentId) => {
      if (subComponentId === targetId) return true;
      return dependsOn(subComponentId, targetId, nextVisited);
    });
  };

  for (const subComponent of subComponentIds) {
    if (dependsOn(subComponent.partId, partId)) {
      throw new Error('Sub-components cannot create recursive assembly relationships.');
    }
  }

  return subComponentIds;
}

async function list(): Promise<PartDoc[]> {
  return Part.find({});
}

async function findById(id: string): Promise<PartDoc | null> {
  return Part.findById(id).populate('customer').populate('material');
}

async function add(data: PartDoc, deviceId: string): Promise<PartDoc> {
  const normalizedSubComponentIds = normalizeSubComponentIds(data.subComponentIds);
  const part = new Part({
    ...data,
    subComponentIds: normalizedSubComponentIds,
  });
  await part.save();
  emit('part', part);
  await Audit.addPartAudit(null, part, deviceId);
  return part;
}

interface UpdatePartOptions {
  preserveManagedMediaFields?: boolean;
}

async function update(
  newPart: PartDoc,
  deviceId: string,
  options: UpdatePartOptions = {},
): Promise<PartDoc | null> {
  const id = newPart._id;
  const oldPart: PartDoc | null = await Part.findById(id);
  if (!oldPart) throw new Error(`Missing part document id: ${id}`);
  const normalizedSubComponentIds = normalizeSubComponentIds(newPart.subComponentIds);
  await validateSubComponentIds(normalizedSubComponentIds, id.toString());
  const updatePayload = {
    ...newPart,
    subComponentIds: normalizedSubComponentIds,
  };

  if (options.preserveManagedMediaFields) {
    updatePayload.img = oldPart.img;
    updatePayload.imageIds = oldPart.imageIds;
    updatePayload.documentIds = oldPart.documentIds;
  }

  const updatedPart = await Part.findByIdAndUpdate(id, updatePayload, { returnDocument: 'after' });
  if (!updatedPart) throw new Error(`Unable to update part document id: ${id}`);
  emit('part', updatedPart);
  await Audit.addPartAudit(oldPart, updatedPart, deviceId);
  return updatedPart;
}

export default {
  list,
  findById,
  add,
  update,
};

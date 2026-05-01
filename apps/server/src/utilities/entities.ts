import { isValidObjectId } from 'mongoose';

export function toPlainEntity(entity: unknown): Record<string, unknown> {
  if (entity && typeof entity === 'object' && 'toObject' in entity) {
    const maybeDoc = entity as { toObject?: () => unknown };
    if (typeof maybeDoc.toObject === 'function') {
      return maybeDoc.toObject() as Record<string, unknown>;
    }
  }

  return entity as Record<string, unknown>;
}

export function getEntityId(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && '_id' in value) {
    return String((value as { _id: unknown })._id);
  }
  if (typeof value === 'object' && value !== null && 'toString' in value) {
    return String(value);
  }

  return undefined;
}

export function getEntityIdOrNull(value: unknown): string | null {
  return getEntityId(value) ?? null;
}

export function normalizeIdArray(values: unknown): string[] | undefined {
  if (!Array.isArray(values)) return undefined;

  return values
    .map((value) => getEntityId(value))
    .filter((value): value is string => Boolean(value));
}

export function normalizeObjectIdArray(values: unknown): string[] {
  return (normalizeIdArray(values) ?? []).filter((value) => isValidObjectId(value));
}

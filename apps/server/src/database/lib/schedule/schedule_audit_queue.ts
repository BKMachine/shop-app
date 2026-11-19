/** One booking's net change while its job was being rearranged. */
export interface QueuedScheduleChange<T> {
  /** The booking before the first change in the run; null when it was created in the run. */
  before: T | null;
  /** The booking after the last change; null when it was removed. */
  after: T | null;
  /** The device that made the last change. */
  deviceId: string;
  /** When the last change was made. */
  timestamp: Date;
}

interface ScheduleAuditQueueOptions<T> {
  /** How long a job's bookings must go untouched before they are audited. */
  quietMs: number;
  /** The booking's id. */
  idOf: (entry: T) => string;
  /** What the changes are grouped by, so a job's bookings are audited together (its job id). */
  groupOf: (entry: T) => string;
  /** Whether two snapshots of a booking are the same for the audit trail. */
  same: (before: T, after: T) => boolean;
  write: (changes: QueuedScheduleChange<T>[]) => Promise<void>;
  onError: (error: unknown) => void;
}

/**
 * Holds schedule audits back until a job's bookings have gone `quietMs` without a change, then
 * writes one audit per booking from where it started to where it ended up. Dragging bookings
 * around writes a single entry instead of one for every drop, and a booking that ends up back
 * where it was writes none.
 */
export function createScheduleAuditQueue<T>(options: ScheduleAuditQueueOptions<T>) {
  const groups = new Map<
    string,
    { changes: Map<string, QueuedScheduleChange<T>>; timer: ReturnType<typeof setTimeout> | null }
  >();
  /** Which group each queued booking is in, so it stays in the one it started in. */
  const groupOfEntry = new Map<string, string>();
  const inFlight = new Set<Promise<void>>();

  function schedule(group: string) {
    const pending = groups.get(group);
    if (!pending) return;
    if (pending.timer) clearTimeout(pending.timer);
    pending.timer = setTimeout(() => void flushGroup(group), options.quietMs);
    pending.timer.unref?.();
  }

  /** Queues the changes between two snapshots of the bookings a change touched. */
  function queue(before: readonly T[], after: readonly T[], deviceId: string) {
    const timestamp = new Date();
    const beforeById = new Map(before.map((entry) => [options.idOf(entry), entry]));
    const afterById = new Map(after.map((entry) => [options.idOf(entry), entry]));
    const touched = new Set<string>();

    for (const id of new Set([...beforeById.keys(), ...afterById.keys()])) {
      const oldEntry = beforeById.get(id) ?? null;
      const newEntry = afterById.get(id) ?? null;
      const group =
        groupOfEntry.get(id) ?? options.groupOf((newEntry ?? oldEntry) as NonNullable<T>);
      groupOfEntry.set(id, group);

      let pending = groups.get(group);
      if (!pending) {
        pending = { changes: new Map(), timer: null };
        groups.set(group, pending);
      }
      const queued = pending.changes.get(id);
      pending.changes.set(id, {
        before: queued ? queued.before : oldEntry,
        after: newEntry,
        deviceId,
        timestamp,
      });
      touched.add(group);
    }

    for (const group of touched) schedule(group);
  }

  async function flushGroup(group: string) {
    const pending = groups.get(group);
    if (!pending) return;
    if (pending.timer) clearTimeout(pending.timer);
    groups.delete(group);
    for (const id of pending.changes.keys()) groupOfEntry.delete(id);

    const changes = [...pending.changes.values()].filter(
      ({ before, after }) =>
        (before !== null || after !== null) &&
        !(before !== null && after !== null && options.same(before, after)),
    );
    if (!changes.length) return;

    const write = options.write(changes).catch(options.onError);
    inFlight.add(write);
    try {
      await write;
    } finally {
      inFlight.delete(write);
    }
  }

  /** Writes every queued audit now, and waits for any already being written; for shutdown. */
  async function flush() {
    await Promise.all([...[...groups.keys()].map(flushGroup), ...inFlight]);
  }

  return { queue, flush, size: () => groupOfEntry.size };
}

import { onScopeDispose } from 'vue';

/**
 * Returns a `trigger` function that calls `fn` after `delayMs` of no further
 * triggers, restarting the timer on each call. The pending timer is
 * automatically cancelled when the owning component unmounts.
 */
export function useDebouncedCallback(fn: () => void, delayMs: number): () => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  function cancel() {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  }

  function trigger() {
    cancel();
    timeoutId = setTimeout(fn, delayMs);
  }

  onScopeDispose(cancel);

  return trigger;
}

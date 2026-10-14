import { computed, reactive, ref } from 'vue';

// A set of fields bound by one relation (e.g. SFM = π·D·RPM/12). Once all but one field are known,
// the remaining field is solved. Editing a field re-solves whichever other field was edited least
// recently, so the user's most recent inputs always stay put.
export interface LinkedFieldsOptions<K extends string> {
  keys: readonly K[];
  // Fields that are only ever entered by the user, never solved for.
  fixed?: readonly K[];
  solve: (key: K, values: Record<K, number>) => number;
  format: (key: K, value: number) => string;
}

export function parsePositive(text: string): number | null {
  const value = Number.parseFloat(text);
  return Number.isFinite(value) && value > 0 ? value : null;
}

// `padded` keeps trailing zeros so a value always shows its full precision (0.0080, not 0.008).
export function formatNumber(value: number, decimals: number, padded = false): string {
  const fixed = value.toFixed(decimals);
  return padded ? fixed : String(Number(fixed));
}

export function useLinkedFields<K extends string>({
  keys,
  fixed = [],
  solve,
  format,
}: LinkedFieldsOptions<K>) {
  const text = reactive(Object.fromEntries(keys.map((key) => [key, '']))) as Record<K, string>;
  // Most recently edited first.
  const history = ref<K[]>([]) as { value: K[] };
  const solvedKey = ref<K | null>(null) as { value: K | null };

  const values = computed(
    () =>
      Object.fromEntries(keys.map((key) => [key, parsePositive(text[key])])) as Record<
        K,
        number | null
      >,
  );

  function recency(key: K) {
    const index = history.value.indexOf(key);
    return index === -1 ? Number.POSITIVE_INFINITY : index;
  }

  function solveFrom(editedKey: K) {
    const others = keys.filter((key) => key !== editedKey && !fixed.includes(key));
    if (others.length === 0) return;
    const target = others.reduce((a, b) => (recency(b) > recency(a) ? b : a));
    const current = values.value;
    const inputsKnown = keys.every((key) => key === target || current[key] !== null);

    if (inputsKnown) {
      const result = solve(target, current as Record<K, number>);
      if (Number.isFinite(result) && result > 0) {
        text[target] = format(target, result);
        solvedKey.value = target;
        return;
      }
    }

    // Not enough inputs left to back the solved value, so drop it rather than show a stale number.
    if (solvedKey.value === target) {
      text[target] = '';
      solvedKey.value = null;
    }
  }

  function setInput(key: K, value: string) {
    text[key] = value;
    history.value = [key, ...history.value.filter((k) => k !== key)];
    if (solvedKey.value === key) solvedKey.value = null;
    solveFrom(key);
  }

  // Rewrite every known value in place (unit changes) without touching edit history.
  function convert(transform: (key: K, value: number) => number) {
    for (const key of keys) {
      const value = values.value[key];
      if (value !== null) text[key] = format(key, transform(key, value));
    }
  }

  function clear() {
    for (const key of keys) text[key] = '';
    history.value = [];
    solvedKey.value = null;
  }

  return { text, values, solvedKey, setInput, convert, clear };
}

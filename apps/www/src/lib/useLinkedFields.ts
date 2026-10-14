import { computed, reactive, ref } from 'vue';

// A group of fields bound by formulas (e.g. SFM = π·D·RPM/12, or IPM = IPT·Z·RPM).
// Fixed fields are only ever entered by the user. Of the remaining "free" fields, the one edited
// most recently is the anchor, and every other free field is solved from the fixed fields + anchor.
// So whatever the user just typed always stays put.
export interface LinkedFieldsOptions<K extends string> {
  keys: readonly K[];
  // User-entered fields that must all be known before anything is solved.
  fixed?: readonly K[];
  // User-entered fields that feed into the formulas but may be left blank.
  optional?: readonly K[];
  solve: (key: K, values: Record<K, number | null>, anchor: K) => number;
  // Turns a field's text into its value; defaults to a plain positive number.
  parse?: (key: K, text: string) => number | null;
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
  optional = [],
  solve,
  parse = (_key, text) => parsePositive(text),
  format,
}: LinkedFieldsOptions<K>) {
  const free = keys.filter((key) => !fixed.includes(key) && !optional.includes(key));
  const text = reactive(Object.fromEntries(keys.map((key) => [key, '']))) as Record<K, string>;
  // Free fields, most recently edited first.
  const history = ref<K[]>([]) as { value: K[] };
  const solvedKeys = ref<K[]>([]) as { value: K[] };

  const values = computed(
    () =>
      Object.fromEntries(keys.map((key) => [key, parse(key, text[key])])) as Record<
        K,
        number | null
      >,
  );

  function resolve() {
    const anchor = history.value[0];
    const current = values.value;
    const ready =
      anchor !== undefined &&
      current[anchor] !== null &&
      fixed.every((key) => current[key] !== null);
    const solved: K[] = [];

    for (const key of free) {
      if (key === anchor) continue;
      if (ready) {
        const result = solve(key, current, anchor);
        if (Number.isFinite(result) && result > 0) {
          text[key] = format(key, result);
          solved.push(key);
          continue;
        }
      }
      // Not enough inputs left to back a solved value, so drop it rather than show a stale number.
      if (solvedKeys.value.includes(key)) text[key] = '';
    }

    solvedKeys.value = solved;
  }

  function setInput(key: K, value: string) {
    text[key] = value;
    if (free.includes(key)) history.value = [key, ...history.value.filter((k) => k !== key)];
    resolve();
  }

  // Rewrite every known value in place (unit changes) without touching edit history.
  // A transform returning null leaves that field's text as typed.
  function convert(transform: (key: K, value: number) => number | null) {
    for (const key of keys) {
      const value = values.value[key];
      if (value === null) continue;
      const next = transform(key, value);
      if (next !== null) text[key] = format(key, next);
    }
  }

  function clear() {
    for (const key of keys) text[key] = '';
    history.value = [];
    solvedKeys.value = [];
  }

  return { text, values, solvedKeys, setInput, resolve, convert, clear };
}

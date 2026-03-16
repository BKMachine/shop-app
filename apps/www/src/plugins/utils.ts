export function isNumber(evt: KeyboardEvent) {
  const keysAllowed: string[] = [
    '0',
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '.',
    'Backspace',
    'ArrowUp',
    'ArrowDown',
  ];
  const keyPressed: string = evt.key;

  if (!keysAllowed.includes(keyPressed)) {
    evt.preventDefault();
  }
}

export function onlyAllowNumeric(e: KeyboardEvent) {
  if (
    [
      'Backspace',
      'Delete',
      'Tab',
      'Escape',
      'Enter',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
    ].includes(e.key)
  ) {
    return;
  }

  if ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase())) {
    return;
  }

  if (/^[0-9.]$/.test(e.key)) {
    return;
  }

  e.preventDefault();
}

export function formatWeight(val: number | null | undefined): string {
  if (val == null || Number.isNaN(val)) return '';
  return parseFloat(val.toFixed(2)).toString();
}

export function formatNumber(val: number | null | undefined): string {
  if (val == null || Number.isNaN(val)) return '';
  return parseFloat(val.toFixed(3)).toString();
}

export function formatCost(val: number | null | undefined): string {
  if (val == null || Number.isNaN(val)) return '';
  return parseFloat(val.toFixed(2)).toString();
}

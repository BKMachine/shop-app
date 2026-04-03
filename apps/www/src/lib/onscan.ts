import baseOnScan, { type ScanOptions as BaseScanOptions, type OnScan } from 'onscan.js';

type FocusTarget = Element | string;

export type ScanOptions = Omit<BaseScanOptions, 'ignoreIfFocusOn'> & {
  ignoreIfFocusOn?: FocusTarget | FocusTarget[];
};

type Scanner = Omit<OnScan, 'attachTo' | 'getOptions' | 'setOptions'> & {
  attachTo(node: Node, options?: ScanOptions): void;
  getOptions(node: Node): ScanOptions;
  setOptions(node: Node, options: ScanOptions): void;
};

const onScan = baseOnScan as unknown as Scanner;

export default onScan;

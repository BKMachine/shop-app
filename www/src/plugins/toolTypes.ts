const milling = [
  'Endmill',
  'Ball Endmill',
  'Chamfer Mill',
  'Drill',
  'Tap - Cutting',
  'Tap - Roll Form',
  '123',
  'Insert',
  'Insert Body',
  'Drill Insert',
  'Drill Body',
  "C'Sink",
  'Dovetail Cutter',
  'Double Angle Cutter',
  'Custom Cutter',
  'Form Cutter',
  'Keyseat Cutter',
  'Reamer',
  'Thread Mill',
  'Tapered Endmill',
  'Lens Cutter',
  'Slitting Saw',
  'Arbor',
] as const;

const turning = ['Insert', 'Stick Holder', 'Bore Bar'] as const;
const other = [] as const;

export default {
  milling,
  turning,
  other,
};

export type MillingType = (typeof milling)[number];
export type TurningType = (typeof turning)[number];
export type OtherType = (typeof other)[number];

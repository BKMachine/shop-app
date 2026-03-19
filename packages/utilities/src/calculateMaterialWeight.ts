interface MaterialWeightInput {
  materialType: string;
  type: 'Flat' | 'Round';
  height: number | null;
  width: number | null;
  diameter: number | null;
  wallThickness: number | null;
  length: number | null;
}

export default function calculateMaterialWeight<T extends MaterialWeightInput>(
  material: T,
): number | null {
  const { materialType, type, height, width, diameter, wallThickness, length } = material;
  const density = materials[materialType]?.density;
  if (!density || !length) return null;

  let volume = 0;

  if (type === 'Flat') {
    if (!height || !width) return null;
    if (wallThickness && wallThickness > 0) {
      const outerVolume = height * width * length;
      const innerVolume = (height - 2 * wallThickness) * (width - 2 * wallThickness) * length;
      volume = outerVolume - innerVolume;
    } else {
      volume = height * width * length;
    }
  } else if (type === 'Round') {
    if (!diameter) return null;
    const radius = diameter / 2;
    if (wallThickness && wallThickness > 0) {
      const outerVolume = Math.PI * radius ** 2 * length;
      const innerRadius = radius - wallThickness;
      const innerVolume = Math.PI * innerRadius ** 2 * length;
      volume = outerVolume - innerVolume;
    } else {
      volume = Math.PI * radius ** 2 * length;
    }
  }

  return volume * density;
}

export const materials: MaterialList = {
  '6061': { density: 0.098, category: 'aluminum' },
  '7075': { density: 0.101, category: 'aluminum' },
  '1018': { density: 0.284, category: 'steel' },
  '1020': { density: 0.284, category: 'steel' },
  '12L14': { density: 0.284, category: 'steel' },
  '4140': { density: 0.284, category: 'steel' },
  '4130': { density: 0.284, category: 'steel' },
  '303': { density: 0.284, category: 'stainless' },
  '304': { density: 0.284, category: 'stainless' },
  '316': { density: 0.284, category: 'stainless' },
  '17-4': { density: 0.284, category: 'stainless' },
  '416': { density: 0.284, category: 'stainless' },
  '420': { density: 0.284, category: 'stainless' },
  '440': { density: 0.284, category: 'stainless' },
  '6AL4V': { density: 0.16, category: 'other' },
  Brass: { density: 0.305, category: 'other' },
  Bronze: { density: 0.32, category: 'other' },
  Copper: { density: 0.32, category: 'other' },
};

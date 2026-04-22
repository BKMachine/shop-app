interface MaterialWeightInput {
  materialType: string;
  type: 'Flat' | 'Round';
  height: number | null;
  width: number | null;
  diameter: number | null;
  wallThickness: number | null;
  length: number | null;
}

type MaterialDimensionsInput = {
  type: 'Flat' | 'Round';
  width: number | null;
  height: number | null;
};

export function normalizeDimensions<T extends MaterialDimensionsInput>(material: T): T {
  if (material.type === 'Flat' && material.width && material.height) {
    if (material.width < material.height) {
      const temp = material.width;
      material.width = material.height;
      material.height = temp;
    }
  }
  return material;
}

export function calculateMaterialWeight<T extends MaterialWeightInput>(material: T): number | null {
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

export function calculateMaterialLengthFromWeight<T extends MaterialWeightInput>(
  material: T,
  weight: number,
): number | null {
  if (!Number.isFinite(weight) || weight <= 0) return null;

  const weightPerInch = calculateMaterialWeight({ ...material, length: 1 });
  if (!weightPerInch || !Number.isFinite(weightPerInch) || weightPerInch <= 0) return null;

  const length = weight / weightPerInch;
  return Number.isFinite(length) && length > 0 ? length : null;
}

// Use full-precision density constants (lb/in^3); do not limit decimal places.
export const materials: MaterialList = {
  '6061': { density: 0.097544, category: 'aluminum' },
  '7075': { density: 0.101519, category: 'aluminum' },
  '1018': { density: 0.283599, category: 'steel' },
  '1020': { density: 0.283599, category: 'steel' },
  '12L14': { density: 0.283599, category: 'steel' },
  '4140': { density: 0.283599, category: 'steel' },
  '4130': { density: 0.283599, category: 'steel' },
  '303': { density: 0.289017, category: 'stainless' },
  '304': { density: 0.289017, category: 'stainless' },
  '316': { density: 0.289017, category: 'stainless' },
  '17-4': { density: 0.282154, category: 'stainless' },
  '416': { density: 0.279627, category: 'stainless' },
  '420': { density: 0.279988, category: 'stainless' },
  '440': { density: 0.279627, category: 'stainless' },
  '6Al-4V': { density: 0.160044, category: 'titanium' },
  '6Al-7Nb': { density: 0.163295, category: 'titanium' },
  Brass: { density: 0.307089, category: 'other' },
  Bronze: { density: 0.317928, category: 'other' },
  Copper: { density: 0.323706, category: 'other' },
};

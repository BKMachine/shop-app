type MaterialDimensionsInput = {
  type: string;
  width: number | null;
  height: number | null;
};

export default function normalizeDimensions<T extends MaterialDimensionsInput>(material: T): T {
  if (material.type === 'Flat' && material.width && material.height) {
    if (material.width < material.height) {
      const temp = material.width;
      material.width = material.height;
      material.height = temp;
    }
  }
  return material;
}

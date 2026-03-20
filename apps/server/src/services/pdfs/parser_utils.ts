export const costRegex: Record<string, RegExp> = {
  lb: /LBS\s*@\s*(\d+\.\d+)\s*LBS/,
  ea: /PCS\s*@\s*(\d+\.\d+)\s*EA/,
  ft: /FT\s*@\s*(\d+\.\d+)\s*FT/,
};

export function parseDimension(dim: string): number {
  const value = dim.trim();
  if (!value) return 0;

  const wallMatch = value.match(/(\d*\.?\d+)\s*W\b/i);
  if (wallMatch?.[1]) {
    const wall = Number.parseFloat(wallMatch[1]);
    return Number.isFinite(wall) ? wall : 0;
  }

  const numericToken = value.match(/^\d+[-\s]\d+\/\d+|^\d+\/\d+|^\d*\.\d+|^\d+/)?.[0];
  if (!numericToken) return 0;

  const normalizedToken = numericToken.replace(/\s+/g, '-');

  if (normalizedToken.includes('/')) {
    const mixed = normalizedToken.split('-').filter(Boolean);

    if (mixed.length === 2) {
      const [wholePart, fractionPart] = mixed;
      const [numerator, denominator] = fractionPart?.split('/') ?? [];
      const whole = Number.parseFloat(wholePart ?? '');
      const num = Number.parseFloat(numerator ?? '');
      const den = Number.parseFloat(denominator ?? '');

      if (Number.isFinite(whole) && Number.isFinite(num) && Number.isFinite(den) && den !== 0) {
        return whole + num / den;
      }
    }

    if (mixed.length === 1) {
      const [numerator, denominator] = mixed[0]?.split('/') ?? [];
      const num = Number.parseFloat(numerator ?? '');
      const den = Number.parseFloat(denominator ?? '');

      if (Number.isFinite(num) && Number.isFinite(den) && den !== 0) {
        return num / den;
      }
    }

    return 0;
  }

  const numeric = Number.parseFloat(normalizedToken);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function extractDimensionHighlightToken(segment: string): string | null {
  const value = segment.trim();
  if (!value) return null;

  const wallToken = value.match(/^(\d*\.?\d+\s*W)\b/i)?.[1]?.replace(/\s+/g, '');
  if (wallToken) return wallToken;

  const numericToken = value.match(/^(\d+[-\s]\d+\/\d+|\d+\/\d+|\d*\.\d+|\d+)/)?.[1];
  if (!numericToken) return null;

  const normalizedToken = numericToken.replace(/\s+/g, '-');
  const suffix = value.slice(numericToken.length).trimStart();

  return suffix.startsWith('"') ? `${normalizedToken}"` : normalizedToken;
}

export function extractActualDimensionSegments(line: string): string[] {
  if (!line) return [];

  const cleaned = line.replace(/^.*\bACTUAL\s+D(?:IMENSIONS|IMENTIONS)\b\s*:?/i, '').trim();

  if (!cleaned) return [];

  return cleaned
    .split(/\bX\b/i)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

/** Maps each image to its file name without the extension, so `fanuc.png` is found as `fanuc`. */
function byName(images: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(images).map(([path, url]) => [path.replace(/^.*\/|\.png$/g, ''), url]),
  );
}

// An image is picked up by being in its folder, named after the brand, type or source it is for.
const brand = byName(
  import.meta.glob<string>('../assets/machine_logos/*.png', { eager: true, import: 'default' }),
);

const type = byName(
  import.meta.glob<string>('../assets/machine_types/*.png', { eager: true, import: 'default' }),
);

const source = byName(
  import.meta.glob<string>('../assets/machine_sources/*.png', { eager: true, import: 'default' }),
);

export default {
  brand,
  type,
  source,
};

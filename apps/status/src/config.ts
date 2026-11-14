/**
 * The web origins allowed to read the API from a browser: CORS_ORIGIN as a comma-separated list,
 * or any origin when it isn't set.
 */
export const corsOrigin = parseOrigins(process.env.CORS_ORIGIN);

function parseOrigins(value = ''): string | string[] {
  const origins = value
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return origins.length === 0 || origins.includes('*') ? '*' : origins;
}

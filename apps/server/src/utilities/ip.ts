export function normalizeIp(ip: string): string {
  if (ip.startsWith('::ffff:')) return ip.slice(7);
  if (ip === '::1') return '127.0.0.1';

  return ip;
}

/**
 * Whether an address is on a private network (the shop LAN, loopback, or IPv6 unique/link-local),
 * as opposed to a request arriving from the internet.
 */
export function isPrivateIp(ip: string | null | undefined): boolean {
  if (!ip) return false;
  const address = normalizeIp(ip.trim()).toLowerCase();

  const octets = address.split('.').map(Number);
  if (
    octets.length === 4 &&
    octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255)
  ) {
    const [a, b] = octets as [number, number, number, number];
    return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }

  return /^f[cd][0-9a-f]{2}:/.test(address) || /^fe[89ab][0-9a-f]:/.test(address);
}

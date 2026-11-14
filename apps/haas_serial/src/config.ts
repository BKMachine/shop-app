import { BlockList, isIP } from 'node:net';

/**
 * The machines this service may connect to: HAAS_SERIAL_ALLOWED_HOSTS as a comma-separated list
 * of addresses, subnets such as 10.30.1.0/24, and host names. Any host is allowed when it isn't
 * set.
 */
export const isAllowedHost = parseAllowedHosts(process.env.HAAS_SERIAL_ALLOWED_HOSTS);

export function parseAllowedHosts(value = ''): (host: string) => boolean {
  const entries = value
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  if (entries.length === 0) return () => true;

  const addresses = new BlockList();
  const names = new Set<string>();
  for (const entry of entries) {
    const [address = '', prefix] = entry.split('/');
    const family = isIP(address) === 6 ? 'ipv6' : 'ipv4';
    if (!isIP(address)) {
      if (prefix !== undefined) throw new Error(`Invalid subnet in allowed hosts: ${entry}`);
      names.add(entry);
    } else if (prefix === undefined) {
      addresses.addAddress(address, family);
    } else {
      const bits = Number(prefix);
      const maxBits = family === 'ipv6' ? 128 : 32;
      if (!/^\d+$/.test(prefix) || bits > maxBits) {
        throw new Error(`Invalid subnet in allowed hosts: ${entry}`);
      }
      addresses.addSubnet(address, bits, family);
    }
  }

  return (host) => {
    const family = isIP(host);
    if (family === 0) return names.has(host.toLowerCase());
    return addresses.check(host, family === 6 ? 'ipv6' : 'ipv4');
  };
}

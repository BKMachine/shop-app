import { isPrivateIp } from '../ip.js';

describe('isPrivateIp', () => {
  it('accepts shop network and loopback addresses', () => {
    for (const ip of ['10.0.0.236', '10.20.1.186', '172.16.0.1', '172.31.255.255', '192.168.1.5']) {
      expect(isPrivateIp(ip)).toBe(true);
    }
    expect(isPrivateIp('127.0.0.1')).toBe(true);
    expect(isPrivateIp('::1')).toBe(true);
    expect(isPrivateIp('::ffff:10.1.1.6')).toBe(true);
    expect(isPrivateIp('fd12:3456::1')).toBe(true);
    expect(isPrivateIp('fe80::1')).toBe(true);
  });

  it('rejects internet addresses and junk', () => {
    for (const ip of ['69.92.10.119', '38.43.8.43', '172.15.0.1', '172.32.0.1', '192.169.0.1']) {
      expect(isPrivateIp(ip)).toBe(false);
    }
    expect(isPrivateIp('2001:db8::1')).toBe(false);
    expect(isPrivateIp('10.0.0')).toBe(false);
    expect(isPrivateIp('')).toBe(false);
    expect(isPrivateIp(null)).toBe(false);
  });
});

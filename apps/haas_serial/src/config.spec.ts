import { parseAllowedHosts } from './config.js';

describe('allowed hosts', () => {
  it('allows any host when none are listed', () => {
    const isAllowed = parseAllowedHosts('');
    expect(isAllowed('10.30.1.57')).toBe(true);
    expect(isAllowed('example.com')).toBe(true);
  });

  it('allows a listed address and nothing else', () => {
    const isAllowed = parseAllowedHosts('10.30.1.57');
    expect(isAllowed('10.30.1.57')).toBe(true);
    expect(isAllowed('10.30.1.58')).toBe(false);
    expect(isAllowed('127.0.0.1')).toBe(false);
  });

  it('allows every address in a listed subnet', () => {
    const isAllowed = parseAllowedHosts('10.30.1.0/24, 192.168.5.20');
    expect(isAllowed('10.30.1.1')).toBe(true);
    expect(isAllowed('10.30.1.254')).toBe(true);
    expect(isAllowed('192.168.5.20')).toBe(true);
    expect(isAllowed('10.30.2.1')).toBe(false);
  });

  it('allows a listed host name, whatever its case', () => {
    const isAllowed = parseAllowedHosts('VF2.shop.lan');
    expect(isAllowed('vf2.shop.lan')).toBe(true);
    expect(isAllowed('vf3.shop.lan')).toBe(false);
  });

  it('allows a listed IPv6 address or subnet', () => {
    const isAllowed = parseAllowedHosts('fd00::/8');
    expect(isAllowed('fd12::1')).toBe(true);
    expect(isAllowed('::1')).toBe(false);
  });

  it('rejects a subnet it cannot read', () => {
    expect(() => parseAllowedHosts('10.30.1.0/33')).toThrow('Invalid subnet');
    expect(() => parseAllowedHosts('10.30.1.0/x')).toThrow('Invalid subnet');
    expect(() => parseAllowedHosts('shop.lan/24')).toThrow('Invalid subnet');
  });
});

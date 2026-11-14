import { MachineRequest } from '../machines.js';

const machine = {
  name: 'RD5',
  displayName: 'RoboDrill 5',
  serialNumber: 'P123',
  brand: 'fanuc',
  model: 'a-D21LiB5',
  source: 'focas',
  type: 'mill',
  paths: '1',
  department: null,
  location: 'rd5',
};

const accepts = (fields: Record<string, unknown>) =>
  MachineRequest.safeParse({ ...machine, ...fields }).success;

describe('MachineRequest', () => {
  it('accepts a complete machine', () => {
    expect(accepts({})).toBe(true);
    expect(accepts({ department: '64b7f0c2a1b2c3d4e5f60718' })).toBe(true);
  });

  it('rejects fields a machine does not have', () => {
    expect(accepts({ _id: '64b7f0c2a1b2c3d4e5f60718' })).toBe(false);
    expect(accepts({ $set: { name: 'x' } })).toBe(false);
  });

  it('rejects values outside the known brands, sources, types and paths', () => {
    expect(accepts({ brand: 'acme' })).toBe(false);
    expect(accepts({ source: 'telepathy' })).toBe(false);
    expect(accepts({ type: 'grinder' })).toBe(false);
    expect(accepts({ paths: '3' })).toBe(false);
  });

  it('rejects a missing name and a department that is not an id', () => {
    expect(accepts({ name: '   ' })).toBe(false);
    expect(accepts({ department: 'Mills' })).toBe(false);
  });

  describe('location', () => {
    it('must be an http address for an arduino', () => {
      expect(accepts({ source: 'arduino', location: 'http://10.30.1.20' })).toBe(true);
      expect(accepts({ source: 'arduino', location: 'me1' })).toBe(false);
      expect(accepts({ source: 'arduino', location: 'file:///etc/passwd' })).toBe(false);
    });

    it('must be an address with a port for a serial machine', () => {
      expect(accepts({ source: 'serial', location: 'http://10.30.1.57:5000' })).toBe(true);
      expect(accepts({ source: 'serial', location: 'http://10.30.1.57' })).toBe(false);
      expect(accepts({ source: 'serial', location: 'vf2' })).toBe(false);
    });

    it('must be a single MQTT topic level for a focas machine', () => {
      expect(accepts({ source: 'focas', location: 'rd5' })).toBe(true);
      expect(accepts({ source: 'focas', location: 'rd5/state' })).toBe(false);
      expect(accepts({ source: 'focas', location: '#' })).toBe(false);
    });

    it('is the device name for an mtconnect machine', () => {
      expect(accepts({ source: 'mtconnect', location: 'NHX 5000' })).toBe(true);
    });
  });
});

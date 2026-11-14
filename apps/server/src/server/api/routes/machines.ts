import { Router } from 'express';
import * as z from 'zod';
import MachineService from '../../../database/lib/machine/machine_service.js';
import logger from '../../../logger.js';
import mongoObjectId from '../../../utilities/mongoObjectId.js';
import HttpError from '../../middleware/httpError.js';
import {
  narrowKnownDevice,
  requireAdmin,
  requireKnownDevice,
} from '../../middleware/knownDevices.js';

const router: Router = Router();

/**
 * Whether a location is one its source can read. The status service connects to whatever a
 * location says, so it must be the kind of address that source uses and nothing else.
 */
function isLocationFor(source: MachineSource, location: string): boolean {
  switch (source) {
    // The address of the board, which is polled over HTTP.
    case 'arduino':
      return ['http:', 'https:'].includes(parseUrl(location)?.protocol ?? '');
    // The address of the machine's serial server, which needs a host and port.
    case 'serial': {
      const url = parseUrl(location);
      return Boolean(url?.hostname && url.port);
    }
    // The machine's name in its MQTT topics, so a single topic level.
    case 'focas':
      return /^[^/#+\s]+$/.test(location);
    // The device's name in the MTConnect agent.
    case 'mtconnect':
      return true;
  }
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export const MachineRequest = z
  .strictObject({
    name: z.string().trim().min(1).max(60),
    displayName: z.string().trim().min(1).max(60),
    serialNumber: z.string().trim().min(1).max(60),
    brand: z.enum(['fanuc', 'mori', 'doosan', 'mitsubishi', 'haas', 'mazak', 'hanwha']),
    model: z.string().trim().min(1).max(60),
    source: z.enum(['focas', 'arduino', 'mtconnect', 'serial']),
    type: z.enum(['lathe', 'mill', 'swiss']),
    paths: z.enum(['1', '2']),
    department: mongoObjectId.nullable(),
    location: z.string().trim().min(1).max(200),
  })
  .refine(({ source, location }) => isLocationFor(source, location), {
    path: ['location'],
    message: 'Location is not an address this source can read.',
  });

/** Two machines can't be read from the same place. */
function isDuplicateLocation(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === 11000;
}

router.get('/machines', async (_req, res, next) => {
  try {
    const machines = await MachineService.list();
    res.status(200).json(machines);
  } catch (e) {
    next(e);
  }
});

router.post('/machines', requireKnownDevice, requireAdmin, async (req, res, next) => {
  narrowKnownDevice(req);
  const { success, data, error } = MachineRequest.safeParse(req.body);
  if (!success) {
    logger.error('Invalid machine data provided:', error.message);
    return next(new HttpError(400, 'Invalid machine data provided.'));
  }

  try {
    const machine = await MachineService.create(data);
    res.status(201).json(machine);
  } catch (e) {
    if (isDuplicateLocation(e)) {
      return next(new HttpError(409, 'Another machine already has this location.'));
    }
    next(e);
  }
});

router.put('/machines/:id', requireKnownDevice, requireAdmin, async (req, res, next) => {
  narrowKnownDevice(req);
  const id = mongoObjectId.safeParse(req.params.id);
  const { success, data, error } = MachineRequest.safeParse(req.body);
  if (!id.success || !success) {
    logger.error('Invalid machine data provided:', error?.message ?? 'invalid machine id');
    return next(new HttpError(400, 'Invalid machine data provided.'));
  }

  try {
    const machine = await MachineService.update(id.data, data);
    if (!machine) return next(new HttpError(404, 'Machine not found.'));
    res.status(200).json(machine);
  } catch (e) {
    if (isDuplicateLocation(e)) {
      return next(new HttpError(409, 'Another machine already has this location.'));
    }
    next(e);
  }
});

export default router;

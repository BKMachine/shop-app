import net from 'node:net';
import logger from './logger.js';
import { readStatus, SerialError } from './serial_service.js';

jest.mock('./logger.js', () => ({
  __esModule: true,
  default: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const TIMEOUT_MS = 100;

const REPLIES: Record<string, string> = {
  Q104: '>>MODE, MEM\r\n',
  Q303: '>>LASTCYCLE, 00000812\r\n',
  Q500: '>>PROGRAM, O00100, IDLE, PARTS, 5\r\n',
};
const STATUS = [
  ['MODE', 'MEM'],
  ['LASTCYCLE', '00000812'],
  ['PROGRAM', 'O00100', 'IDLE', 'PARTS', '5'],
];

const servers: net.Server[] = [];

/** A stand-in for a machine's serial server, handling each command it is sent. */
async function machine(
  onCommand: (command: string, socket: net.Socket) => void = (command, socket) => {
    socket.write(REPLIES[command] ?? '');
  },
) {
  const seen = { connections: 0, closed: 0, commands: [] as string[] };
  const server = net.createServer((socket) => {
    seen.connections++;
    socket.on('error', () => {});
    socket.on('close', () => seen.closed++);
    socket.on('data', (data) => {
      const command = data.toString().trim();
      seen.commands.push(command);
      onCommand(command, socket);
    });
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as net.AddressInfo;
  return { address: { host: '127.0.0.1', port }, seen };
}

const read = (address: { host: string; port: number }) => readStatus(address, TIMEOUT_MS);

/** The error a reading fails with. */
async function failure(reading: Promise<unknown>): Promise<SerialError> {
  const error = await reading.then(
    () => null,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(SerialError);
  return error as SerialError;
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))),
  );
});

describe('reading a machine', () => {
  it('returns the reply to each command split into values', async () => {
    const { address, seen } = await machine();

    expect(await read(address)).toEqual(STATUS);
    expect(seen.commands).toEqual(['Q104', 'Q303', 'Q500']);
  });

  it('keeps only letters and digits, dropping an echoed command', async () => {
    const { address } = await machine((command, socket) => {
      socket.write(
        command === 'Q104' ? 'Q104\x02MODE, ZERO RET\x17\r\n>' : (REPLIES[command] ?? ''),
      );
    });

    expect((await read(address))[0]).toEqual(['MODE', 'ZERORET']);
  });

  it('waits for the end of a reply that arrives in pieces', async () => {
    const { address } = await machine((command, socket) => {
      const reply = REPLIES[command] ?? '';
      socket.write(reply.slice(0, 5));
      setTimeout(() => socket.write(reply.slice(5)), 10);
    });

    expect(await read(address)).toEqual(STATUS);
  });

  it('closes its connection when done', async () => {
    const { address, seen } = await machine();
    await read(address);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(seen.closed).toBe(1);
  });

  describe('requests for the same machine', () => {
    it('share one connection while it is being read', async () => {
      const { address, seen } = await machine();

      const results = await Promise.all([read(address), read(address), read(address)]);

      expect(results).toEqual([STATUS, STATUS, STATUS]);
      expect(seen.connections).toBe(1);
    });

    it('read it again once the first reading is done', async () => {
      const { address, seen } = await machine();

      await read(address);
      expect(await read(address)).toEqual(STATUS);

      expect(seen.connections).toBe(2);
    });

    it('read it again after a failed reading', async () => {
      let silent = true;
      const { address } = await machine((command, socket) => {
        if (!silent) socket.write(REPLIES[command] ?? '');
      });
      await failure(read(address));

      silent = false;
      expect(await read(address)).toEqual(STATUS);
    });
  });

  describe('logging', () => {
    beforeEach(() => jest.clearAllMocks());

    it('says nothing while a machine keeps replying', async () => {
      const { address } = await machine();
      await read(address);
      await read(address);

      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalled();
    });

    it('logs a machine that stops replying once, however often it is asked', async () => {
      const { address } = await machine(() => {});
      await failure(read(address));
      await failure(read(address));
      await failure(read(address));

      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        `127.0.0.1:${address.port} is not replying: No reply to Q104 within ${TIMEOUT_MS}ms`,
      );
    });

    it('logs again when the reason changes, and when the machine replies again', async () => {
      let mode: 'silent' | 'drop' | 'reply' = 'silent';
      const { address } = await machine((command, socket) => {
        if (mode === 'drop') socket.destroy();
        if (mode === 'reply') socket.write(REPLIES[command] ?? '');
      });
      await failure(read(address));

      mode = 'drop';
      await failure(read(address));
      expect(logger.warn).toHaveBeenCalledTimes(2);

      mode = 'reply';
      await read(address);
      await read(address);
      expect(logger.info).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith(`127.0.0.1:${address.port} is replying again`);
    });
  });

  describe('failures', () => {
    it('is unavailable (503) when nothing answers at the address', async () => {
      const { address } = await machine();
      await Promise.all(
        servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))),
      );

      const error = await failure(read(address));

      expect(error.status).toBe(503);
      expect(error.message).toContain('ECONNREFUSED');
    });

    it('times out (504) when the machine connects but never replies', async () => {
      const { address, seen } = await machine(() => {});

      const error = await failure(read(address));

      expect(error.status).toBe(504);
      expect(error.message).toBe(`No reply to Q104 within ${TIMEOUT_MS}ms`);
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(seen.closed).toBe(1);
    });

    it('fails at once (502) when the machine drops the connection', async () => {
      const { address } = await machine((_command, socket) => socket.destroy());
      const started = Date.now();

      const error = await failure(readStatus(address, 2000));

      expect(error.status).toBe(502);
      expect(Date.now() - started).toBeLessThan(1000);
    });

    it('stops at the first command that fails', async () => {
      const { address, seen } = await machine((command, socket) => {
        if (command === 'Q104') socket.write(REPLIES.Q104 ?? '');
      });

      const error = await failure(read(address));

      expect(error.message).toBe(`No reply to Q303 within ${TIMEOUT_MS}ms`);
      expect(seen.commands).toEqual(['Q104', 'Q303']);
    });
  });
});

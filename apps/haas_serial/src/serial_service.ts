import net from 'node:net';
import logger from './logger.js';

const TIMEOUT_MS = 1000;

// https://www.haascnc.com/service/troubleshooting-and-how-to/how-to/machine-data-collection---ngc.html
const COMMANDS: QCode[] = [
  104, // MODE, xxxxx
  303, // LASTCYCLE, xxxxxxx
  500, // PROGRAM, Oxxxxx, STATUS, PARTS, xxxxx
];

export interface Address {
  host: string;
  port: number;
}

/** A machine couldn't be read. The status is the one to answer the request with. */
export class SerialError extends Error {
  readonly status: 502 | 503 | 504;

  constructor(status: 502 | 503 | 504, message: string) {
    super(message);
    this.name = 'SerialError';
    this.status = status;
  }
}

const readings = new Map<string, Promise<string[][]>>();

/**
 * Reads a machine's status, as its reply to each command split into values.
 *
 * A machine's serial server takes one connection at a time, so requests arriving while it is
 * already being read share that reading.
 */
export function readStatus(
  { host, port }: Address,
  timeoutMs: number = TIMEOUT_MS,
): Promise<string[][]> {
  const machine = `${host}:${port}`;
  let reading = readings.get(machine);
  if (!reading) {
    logger.debug(`Reading ${machine}`);
    reading = query(host, port, timeoutMs).finally(() => readings.delete(machine));
    readings.set(machine, reading);
  }
  return reading;
}

async function query(host: string, port: number, timeoutMs: number): Promise<string[][]> {
  const socket = await connect(host, port, timeoutMs);
  try {
    const replies: string[][] = [];
    for (const code of COMMANDS) replies.push(await send(socket, code, timeoutMs));
    return replies;
  } catch (error) {
    logger.debug(`Reading ${host}:${port} failed: ${(error as Error).message}`);
    throw error;
  } finally {
    socket.destroy();
  }
}

function connect(host: string, port: number, timeoutMs: number): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port });

    const fail = (message: string) => {
      clearTimeout(timer);
      socket.destroy();
      logger.debug(`Connecting to ${host}:${port} failed: ${message}`);
      reject(new SerialError(503, message));
    };
    const timer = setTimeout(() => fail(`Connection timeout after ${timeoutMs}ms`), timeoutMs);
    const onError = (error: Error) => fail(error.message);

    socket.once('error', onError);
    socket.once('connect', () => {
      clearTimeout(timer);
      socket.off('error', onError);
      // An error with nothing listening for it would exit this service, and one can still
      // arrive between commands or after the last reply.
      socket.on('error', (error) => logger.debug(`Socket error from ${host}:${port}: ${error}`));
      resolve(socket);
    });
  });
}

function send(socket: net.Socket, code: QCode, timeoutMs: number): Promise<string[]> {
  return new Promise((resolve, reject) => {
    if (socket.destroyed || !socket.writable) {
      reject(new SerialError(502, `Connection closed before Q${code} could be sent`));
      return;
    }

    let data = Buffer.alloc(0);

    const finish = () => {
      clearTimeout(timer);
      socket.off('data', onData);
      socket.off('error', onError);
      socket.off('close', onClose);
    };
    const fail = (status: 502 | 504, message: string) => {
      finish();
      reject(new SerialError(status, message));
    };

    const onData = (chunk: Buffer) => {
      data = Buffer.concat([data, chunk]);
      // A reply ends with CR LF
      if (!data.includes('\r\n')) return;
      finish();
      logger.debug(`Reply to Q${code}: ${data.toString('ascii').replace(/[\r\n]/g, '')}`);
      resolve(parse(data));
    };
    const onError = (error: Error) => fail(502, error.message);
    const onClose = () => fail(502, `Connection closed before the reply to Q${code}`);
    const timer = setTimeout(
      () => fail(504, `No reply to Q${code} within ${timeoutMs}ms`),
      timeoutMs,
    );

    socket.on('data', onData);
    socket.on('error', onError);
    socket.on('close', onClose);
    socket.write(`Q${code}\r\n`);
  });
}

function parse(result: Buffer) {
  const resultArray = result
    .toString('ascii')
    .replace(/[^0-9A-Z,]/gi, '')
    .split(',');
  if (resultArray[0]) resultArray[0] = resultArray[0].replace(/^Q[0-9]+/, '');
  return resultArray;
}

import net from 'node:net';
import { RemoteSerialPort } from 'remote-serial-port-client';

type PendingRequest = {
  resolve: (value: string[][]) => void;
  reject: (reason?: unknown) => void;
};

const queue = new Map<string, PendingRequest[]>();
const inProgress = new Set<string>();

export async function fetch(url: string): Promise<string[][]> {
  // Add this request to the queue for this URL
  const pending = new Promise<string[][]>((resolve, reject) => {
    const urlQueue = queue.get(url) ?? [];
    if (!queue.has(url)) {
      queue.set(url, urlQueue);
    }
    urlQueue.push({ resolve, reject });

    // If no request is already in progress for this URL, start one
    if (!inProgress.has(url)) {
      inProgress.add(url);
      serial(url)
        .then((result) => {
          // Resolve all pending requests for this URL
          const pendingRequests = queue.get(url) ?? [];
          queue.delete(url);
          pendingRequests.forEach(({ resolve: res }) => {
            res(result);
          });
        })
        .catch((error) => {
          // Reject all pending requests for this URL
          const pendingRequests = queue.get(url) ?? [];
          queue.delete(url);
          pendingRequests.forEach(({ reject: rej }) => {
            rej(error);
          });
        })
        .finally(() => {
          inProgress.delete(url);
        });
    }
  });

  return pending;
}

async function serial(url: string): Promise<string[][]> {
  const { hostname, port } = new URL(url);
  const isOpen = await isRemotePortOpen(hostname, parseInt(port, 10), 200);
  if (!isOpen) {
    const error = new Error(`Cannot connect to ${hostname}:${port}`);
    (error as any).status = 503;
    throw error;
  }

  const responses: string[][] = [];
  const tcp: RSPC = new RemoteSerialPort({ mode: 'tcp', host: hostname, port, reconnect: false });
  await open(tcp);
  // https://www.haascnc.com/service/troubleshooting-and-how-to/how-to/machine-data-collection---ngc.html
  responses.push(await send(tcp, 104)); // MODE, xxxxx
  responses.push(await send(tcp, 303)); // LASTCYCLE, xxxxxxx
  responses.push(await send(tcp, 500)); // PROGRAM, Oxxxxx, STATUS, PARTS, xxxxx
  tcp.close();
  return responses;
}

function open(tcp: RSPC): Promise<void> {
  const seconds = 3;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      tcp.close();
      reject(new Error(`Connection timeout after ${seconds} seconds`));
    }, seconds * 1000);

    tcp.open((error) => {
      if (timeout) clearTimeout(timeout);
      if (error) reject(error);
      else resolve();
    });
  });
}

async function send(tcp: RSPC, code: QCode): Promise<string[]> {
  return new Promise((resolve, reject) => {
    tcp.write(`Q${code}\r`);
    setTimeout(() => {
      tcp.read((error, result) => {
        if (error) reject(error);
        else resolve(parse(result));
      });
    }, 500);
  });
}

function parse(result: Buffer) {
  return result
    .toString('ascii')
    .replace(/[^0-9A-Z,]/gi, '')
    .split(',');
}

function isRemotePortOpen(host: string, port: number, timeout = 2000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    socket.setTimeout(timeout);

    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.once('error', (_err) => {
      socket.destroy();
      resolve(false);
    });

    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, host);
  });
}

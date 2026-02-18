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
  const isOpen = await isRemotePortOpen(hostname, parseInt(port, 10), 1000);
  if (!isOpen) {
    const error = new Error(`Cannot connect to ${url}`);
    (error as any).status = 503;
    throw error;
  }

  const responses: string[][] = [];
  const tcp: RSPC = new RemoteSerialPort({ mode: 'tcp', host: hostname, port, reconnect: false });
  try {
    await open(tcp);
    // https://www.haascnc.com/service/troubleshooting-and-how-to/how-to/machine-data-collection---ngc.html
    responses.push(await send(tcp, 104)); // MODE, xxxxx
    responses.push(await send(tcp, 303)); // LASTCYCLE, xxxxxxx
    responses.push(await send(tcp, 500)); // PROGRAM, Oxxxxx, STATUS, PARTS, xxxxx
  } catch (error) {
    tcp.close();
    throw error;
  } finally {
    tcp.close();
  }
  return responses;
}

function open(tcp: RSPC): Promise<void> {
  const seconds = 3;

  return new Promise((resolve, reject) => {
    let finished = false;

    const timeout = setTimeout(() => {
      if (finished) return;
      finished = true;
      tcp.close();
      reject(new Error(`Connection timeout after ${seconds} seconds`));
    }, seconds * 1000);

    const handleError = (error: any) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      tcp.close();
      reject(error);
    };

    tcp.on('error', handleError);
    tcp.open((error) => {
      if (finished) return;
      clearTimeout(timeout);
      finished = true;
      if (error) {
        tcp.close();
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

async function send(tcp: RSPC, code: QCode): Promise<string[]> {
  return new Promise((resolve, reject) => {
    let data = Buffer.alloc(0);
    let finished = false;

    const onRead = (result: any) => {
      if (finished) return;

      data = Buffer.concat([data, result.data]);

      // Check if we've received the EOL (CR LF)
      if (data.includes('\r\n')) {
        finished = true;
        clearTimeout(timeout);
        resolve(parse(data));
      }
    };

    const onError = (error: any) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      reject(error);
    };

    // Add a safety timeout in case no EOL is received
    const timeout = setTimeout(() => {
      if (finished) return;
      finished = true;
      reject(new Error('No EOL received within timeout'));
    }, 500);

    tcp.on('read', onRead);
    tcp.on('error', onError);
    try {
      tcp.write(`Q${code}\r\n`);
    } catch (error) {
      finished = true;
      clearTimeout(timeout);
      reject(error);
    }
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

import { RemoteSerialPort } from 'remote-serial-port-client';
import logger from './logger.js';

type PendingRequest = {
  resolve: (value: string[][]) => void;
  reject: (reason?: unknown) => void;
};

const queue = new Map<string, PendingRequest[]>();
const inProgress = new Set<string>();

export async function fetch(url: string): Promise<string[][]> {
  // Add this request to the queue for this URL
  logger.debug(`Received request for ${url}`);
  const pending = new Promise<string[][]>((resolve, reject) => {
    const urlQueue = queue.get(url) ?? [];
    if (!queue.has(url)) {
      queue.set(url, urlQueue);
    }
    urlQueue.push({ resolve, reject });

    // If no request is already in progress for this URL, start one
    if (!inProgress.has(url)) {
      logger.debug(`Starting new request for ${url}`);
      inProgress.add(url);
      serial(url)
        .then((result) => {
          // Resolve all pending requests for this URL
          const pendingRequests = queue.get(url) ?? [];
          queue.delete(url);
          logger.debug(
            `Request for ${url} completed, resolving ${pendingRequests.length} pending requests`,
          );
          pendingRequests.forEach(({ resolve: res }) => {
            res(result);
          });
        })
        .catch((error) => {
          // Reject all pending requests for this URL
          const pendingRequests = queue.get(url) ?? [];
          queue.delete(url);
          logger.debug(
            `Request for ${url} failed, rejecting ${pendingRequests.length} pending requests: ${error.message}`,
          );
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
  const responses: string[][] = [];
  const tcp: RSPC = new RemoteSerialPort({ mode: 'tcp', host: hostname, port, reconnect: false });

  try {
    logger.debug(`Attempting to open serial communication to ${url}`);
    await open(tcp);
    logger.debug(`Serial communication to ${url} opened successfully`);
  } catch (error: any) {
    logger.debug(`Error during open serial communication to ${url}: ${error.message}`);
    tcp.close();
    error.status = 503; // Service Unavailable
    throw error;
  }

  // https://www.haascnc.com/service/troubleshooting-and-how-to/how-to/machine-data-collection---ngc.html
  try {
    responses.push(await send(tcp, 104, url)); // MODE, xxxxx
    responses.push(await send(tcp, 303, url)); // LASTCYCLE, xxxxxxx
    responses.push(await send(tcp, 500, url)); // PROGRAM, Oxxxxx, STATUS, PARTS, xxxxx
  } catch (error: any) {
    logger.debug(`Error during serial communication to ${url}: ${error.message}`);
    tcp.close();
    throw error;
  } finally {
    logger.debug(`Closing serial communication to ${url}`);
    tcp.close();
  }
  return responses;
}

function open(tcp: RSPC): Promise<void> {
  const seconds = 1;

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

async function send(tcp: RSPC, code: QCode, url: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    let data = Buffer.alloc(0);
    let finished = false;

    const onRead = (result: any) => {
      if (finished) return;

      data = Buffer.concat([data, result.data]);

      // Check if we've received the EOL (CR LF)
      if (data.includes('\r\n')) {
        logger.debug(
          `Received response for Q${code} from ${url}: ${data.toString('ascii').trim().replace(/\r?\n/g, '')}`,
        );
        finished = true;
        clearTimeout(timeout);
        resolve(parse(data));
      }
    };

    const onError = (error: any) => {
      logger.debug(`Error while waiting for response to Q${code} from ${url}: ${error.message}`);
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
    }, 1000);

    tcp.on('read', onRead);
    tcp.on('error', onError);

    try {
      logger.debug(`Sending command Q${code} to ${url}`);
      tcp.write(`Q${code}\r\n`);
      logger.debug(`Command Q${code} sent, waiting for response...`);
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

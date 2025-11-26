import { RemoteSerialPort } from 'remote-serial-port-client';

export async function fetch(url: string): Promise<string[][]> {
  return serial(url);
}

async function serial(url: string): Promise<string[][]> {
  const { hostname, port } = new URL(url);
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
  return new Promise((resolve, reject) => {
    tcp.open((error) => {
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

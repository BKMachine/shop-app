declare module 'remote-serial-port-client' {
  export class RemoteSerialPort {
    constructor(options: { mode: 'tcp'; host: string; port: string; reconnect: boolean });
    open(callback: (error?: Error) => void): void;
    write(text: string): void;
    read(callback: (error: Error, result: { data: Buffer }) => void): void;
    close(): void;
    on(event: 'read', listener: (result: { data: Buffer }) => void): void;
    on(event: 'error', listener: (error: Error) => void): void;
  }
}

type RSPC = import('remote-serial-port-client').RemoteSerialPort;

module 'remote-serial-port-client';

interface RSPC {
  open(callback: (error: Error)  => void);
  write(text: string);
  read(callback: (error: Error, result: Buffer) => void);
  close: () => void;
}

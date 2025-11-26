import * as logger from '@repo/utilities/logger';
import type { Logger } from 'winston';

const myLogger: Logger = logger.create('haas_serial');

class MyStream {
  write(text: string) {
    myLogger.info(text.trim());
    // TODO: remove color codes in .log files
    // TODO: separate http log file?
  }
}

export default myLogger;
export const stream = new MyStream();

import * as logger from '@repo/utilities/logger';

const myLogger = logger.create('status');

class MyStream {
  write(text: string) {
    myLogger.info(text.trim());
    // TODO: remove color codes in .log files
    // TODO: separate http log file?
  }
}

export default myLogger;
export const stream = new MyStream();

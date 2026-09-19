import { createAppLogger } from '@repo/utilities/logger';

const { logger, stream } = createAppLogger('haas_serial', { debug: Boolean(process.env.DEBUG) });

export default logger;
export { stream };

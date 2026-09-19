import { createAppLogger } from '@repo/utilities/logger';

const { logger, stream } = createAppLogger('server');

export default logger;
export { stream };

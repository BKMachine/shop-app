import { createAppLogger } from '@repo/utilities/logger';

const { logger, stream } = createAppLogger('status');

export default logger;
export { stream };

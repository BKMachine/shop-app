import { createAppLogger } from '@repo/utilities/logger';

const { logger, stream } = createAppLogger('image-processor');

export default logger;
export { stream };

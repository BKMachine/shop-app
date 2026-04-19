import { isValidObjectId } from 'mongoose';
import { z } from 'zod';

const mongoObjectId = z.string().refine((val) => isValidObjectId(val), {
  message: 'Invalid MongoDB ObjectId',
});

export default mongoObjectId;

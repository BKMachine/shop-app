import { Types, Document } from 'mongoose';

// _id is a string for frontend
// _id is a Mongoose ObjectId for backend

declare global {
  /* WORKER */
  interface Worker {
    _id: string;
    uri: string;
    doPolling: boolean;
    __v: number;
  }

  interface WorkerDoc extends Omit<Worker, '_id'>, Document<Types.ObjectId> {
    _id: Types.ObjectId;
  }
}

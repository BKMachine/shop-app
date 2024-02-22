import mongoose from 'mongoose';
import logger from '../logger';

const options: mongoose.ConnectOptions = {};

export async function connect(): Promise<void> {
  if (!process.env.MONGO_URL) throw new Error('Missing MONGO_URL environment variable.');
  const url = process.env.MONGO_URL;
  const { hostname, pathname } = new URL(url);
  await mongoose.connect(url, options);
  logger.info(`Connected to MongoDB: '${hostname}${pathname}'`);
}

export async function disconnect(): Promise<void> {
  await mongoose.disconnect();
  logger.info('Database connection closed');
}

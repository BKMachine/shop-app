import fs from 'fs';
import path from 'path';

export const logDir = path.join(process.cwd(), 'logs');
export const staticDir = path.join(process.cwd(), 'static');

const arr = [logDir, staticDir];

arr.forEach((loc) => {
  if (!fs.existsSync(loc)) fs.mkdirSync(loc, { recursive: true });
});

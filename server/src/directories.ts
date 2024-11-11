import fs from 'fs';
import path from 'path';

export const logDir = path.join(process.cwd(), 'logs');
export const imgDir = path.join(process.cwd(), 'images');

const arr = [logDir, imgDir];

arr.forEach((loc) => {
  if (!fs.existsSync(loc)) fs.mkdirSync(loc);
});

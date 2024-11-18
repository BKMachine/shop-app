import fs from 'fs';
import path from 'path';

export const logDir = path.join(process.cwd(), 'logs');

// Statically served content such as part and tool pictures, prints, documents
export const staticDir = path.join(process.cwd(), 'static');
// Directory for recently uploaded files
export const recentDir = path.join(staticDir, 'recent');

const arr = [logDir, staticDir, recentDir];

arr.forEach((loc) => {
  if (!fs.existsSync(loc)) fs.mkdirSync(loc, { recursive: true });
});

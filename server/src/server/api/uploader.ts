import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { imgDir } from '../../directories';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { type, id } = req.body;
    const dir = path.join(imgDir, type, id);

    fs.mkdir(dir, { recursive: true }, (err) => {
      if (err) return cb(err, dir);
      cb(null, dir);
    });
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

export default multer({ storage: storage });

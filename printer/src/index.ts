import axios from 'axios';
import express from 'express';

const app = express();

app.post('/print', async (req, res, next) => {
  const host = '127.0.0.1';
  const port = 41951;
  const url = `https://${host}:${port}`;
  await axios.post(url);
  res.sendStatus(204);
});

app.listen(process.env.PORT || 3000);

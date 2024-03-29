process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import express from 'express';
import morgan from 'morgan';
import Dymo from 'dymojs';

const app = express();
const dymo = new Dymo();

app.use(morgan('combined'));
app.use(express.json());

app.get('/', (req, res, next) => {
  res.status(200).json({ message: 'Printer Proxy' });
});

app.post('/print', async (req, res, next) => {
  const { printerName, labelXml } = req.body;
  if (!printerName || !labelXml) {
    res.sendStatus(400);
    return;
  }
  try {
    await dymo.print(printerName, labelXml);
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
});

const port = process.env.PORT || 3005;
app.listen(port);
console.log(`Listening on port: ${port}`);

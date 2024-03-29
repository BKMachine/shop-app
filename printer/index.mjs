import express from 'express';
import morgan from 'morgan';

const app = express();

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
    await print(printerName, labelXml);
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
});

const port = process.env.PORT || 3005;
app.listen(port);
console.log(`Listening on port: ${port}` )

async function print(printerName, labelXml, labelSetXml = '') {
    const hostname = '127.0.0.1';
    const port = 41951;
    const label = `printerName=${encodeURIComponent(printerName)}&printParamsXml=&labelXml=${encodeURIComponent(labelXml)}&labelSetXml=${encodeURIComponent(labelSetXml)}`;
    if (typeof process !== 'undefined' && process.env) process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

    const url = `https://${hostname}:${port}/DYMO/DLS/Printing/PrintLabel`
    const requestOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: label,
    };
    return await fetch(url, requestOptions);
}

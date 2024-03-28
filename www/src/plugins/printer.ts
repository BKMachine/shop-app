import axios from './axios';

function printLocation(data: { loc: string; pos: string }) {
  axios.post('/print/location', { ...data }).then(async ({ data }) => {
    await print(data.printerName, data.label);
  });
}

async function print(printerName: string, labelXml: string, labelSetXml = '') {
  const hostname = '127.0.0.1';
  const port = 41951;
  const label = `printerName=${encodeURIComponent(printerName)}&printParamsXml=&labelXml=${encodeURIComponent(labelXml)}&labelSetXml=${encodeURIComponent(labelSetXml)}`;
  if (typeof process !== 'undefined' && process.env) process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  const requestOptions = {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: label,
  };
  return await fetch(`https://${hostname}:${port}/DYMO/DLS/Printing/PrintLabel`, requestOptions);
}

export default {
  printLocation,
};

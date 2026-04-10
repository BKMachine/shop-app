import axios from './axios';
import { toastError, toastSuccess } from './vue-toast-notification';

function openPdfPreview(blob: Blob) {
  const previewUrl = URL.createObjectURL(blob);
  const previewWindow = window.open(previewUrl, '_blank');

  if (!previewWindow) {
    window.location.assign(previewUrl);
  } else {
    previewWindow.addEventListener('beforeunload', () => {
      URL.revokeObjectURL(previewUrl);
    });
  }
}

async function printLocation(data: PrintLocationBody) {
  if (!data.loc || !data.pos) return;
  const response = await axios.post('/print/location', data, { responseType: 'blob' });
  openPdfPreview(response.data);
  return response;
}

async function printAddress(data: PrintItemBody) {
  if (!data.item || !data.description) return;
  const response = await axios.post('/print/address', data, { responseType: 'blob' });
  openPdfPreview(response.data);
  return response;
}

async function printPartPosition(data: PrintPartPositionBody) {
  if (!data.partId || !data.part || !data.description || !data.loc || !data.pos) return;
  await axios
    .post('/print/part-position', data, { responseType: 'blob' })
    .then((response) => {
      if (import.meta.env.DEV) openPdfPreview(response.data);
      toastSuccess('Sent to printer!');
    })
    .catch((error) => {
      console.error('Error printing part position label:', error);
      toastError('Failed to print part position label.');
    });
}

export default {
  printLocation,
  printAddress,
  printPartPosition,
};

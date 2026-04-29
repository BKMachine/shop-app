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

async function printItem(data: PrintItemBody) {
  await axios
    .post('/print/item', data, { responseType: 'blob' })
    .then((response) => {
      if (import.meta.env.DEV) openPdfPreview(response.data);
      toastSuccess('Sent to printer!');
    })
    .catch((error) => {
      console.error('Error printing item label:', error);
      toastError('Failed to print item label.');
    });
}

export default {
  printLocation,
  printItem,
};

import axios from './axios';

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
  if (!data.item || !data.description) return;
  const response = await axios.post('/print/item', data, { responseType: 'blob' });
  openPdfPreview(response.data);
  return response;
}

export default {
  printLocation,
  printItem,
};

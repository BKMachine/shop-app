import uniq from 'lodash/uniq';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import axios from '@/plugins/axios';
import { useCustomerStore } from '@/stores/customer_store';

export const usePartStore = defineStore('parts', () => {
  const customerStore = useCustomerStore();

  const rawParts = ref<Part[]>([]);

  const parts = computed<Part[]>(() => {
    return rawParts.value.map((x) => {
      return {
        ...x,
        customer: customerStore.customers.find((y) => y._id === x.customer) || x.customer,
      };
    });
  });

  const locations = computed(() => {
    return uniq(
      parts.value
        .filter((x) => x.location)
        .map((x) => x.location)
        .sort((a, b) => {
          const c = (a as string).toLowerCase();
          const d = (b as string).toLowerCase();
          if (c < d) return -1;
          else if (c > d) return 1;
          else return 0;
        }),
    );
  });

  const loading = ref(false);
  const imagesByPartId = ref<Record<string, MyImageData[]>>({});
  const documentsByPartId = ref<Record<string, MyDocumentData[]>>({});
  const notesByPartId = ref<Record<string, MyPartNoteData[]>>({});

  function updateRawPart(partId: string, updater: (part: Part) => void) {
    const index = rawParts.value.findIndex((part) => part._id === partId);
    const part = rawParts.value[index];
    if (!part) return;
    updater(part);
  }

  function getPartImages(partId: string) {
    return imagesByPartId.value[partId] || [];
  }

  function getPartDocuments(partId: string) {
    return documentsByPartId.value[partId] || [];
  }

  function getPartNotes(partId: string) {
    return notesByPartId.value[partId] || [];
  }

  function fetch() {
    loading.value = true;
    axios
      .get<Part[]>('/parts')
      .then(({ data }) => {
        rawParts.value = data;
      })
      .finally(() => {
        loading.value = false;
      });
  }

  const lastId = ref<string | null>(null);
  function setLastId(id: string | null) {
    lastId.value = id;
  }

  async function add(part: Part) {
    await axios.post<Part>('/parts', { data: part }).then(({ data }) => {
      rawParts.value.push(data);
    });
  }

  async function update(part: Part) {
    await axios.put<Part>('/parts', { data: part }).then(({ data }) => {
      const index = rawParts.value.findIndex((x) => x._id === data._id);
      if (index > -1) rawParts.value[index] = data;
    });
  }

  function updatePartImage(partId: string, img: string) {
    updateRawPart(partId, (part) => {
      part.img = img;
    });
  }

  function updatePartImageIds(partId: string, imageIds: string[]) {
    updateRawPart(partId, (part) => {
      part.imageIds = imageIds;
    });
  }

  function updatePartDocumentIds(partId: string, documentIds: string[]) {
    updateRawPart(partId, (part) => {
      part.documentIds = documentIds;
    });
  }

  async function loadPartImages(partId: string) {
    const { data } = await axios.get<MyImageData[]>(`/images/entities/part/${partId}/images`);
    imagesByPartId.value = {
      ...imagesByPartId.value,
      [partId]: data,
    };
    updatePartImageIds(
      partId,
      data.map((image) => image.id),
    );
    updatePartImage(
      partId,
      data.find((image) => image.isMain)?.url || '',
    );
    return data;
  }

  async function attachTempImageToPart(partId: string, imageId: string, setAsMain: boolean) {
    const { data } = await axios.post<MyImageData>(`/images/uploads/${imageId}/attach`, {
      entityType: 'part',
      entityId: partId,
      setAsMain,
    });
    await loadPartImages(partId);
    return data;
  }

  async function promotePartImage(partId: string, imageId: string) {
    const { data } = await axios.post<MyImageData>(`/images/${imageId}/promote-to-main`, {
      entityType: 'part',
      entityId: partId,
    });
    await loadPartImages(partId);
    return data;
  }

  async function deletePartImage(partId: string, imageId: string) {
    const { data } = await axios.delete<{ nextMainImageId?: string; nextMainImageUrl?: string }>(
      `/images/entities/part/${partId}/images/${imageId}`,
    );
    await loadPartImages(partId);
    return data;
  }

  async function loadPartDocuments(partId: string) {
    const { data } = await axios.get<MyDocumentData[]>(`/documents/entities/part/${partId}/documents`);
    documentsByPartId.value = {
      ...documentsByPartId.value,
      [partId]: data,
    };
    updatePartDocumentIds(
      partId,
      data.map((document) => document.id),
    );
    return data;
  }

  async function uploadPartDocument(partId: string, file: File) {
    const formData = new FormData();
    formData.append('document', file);

    const { data } = await axios.post<MyDocumentData>(
      `/documents/entities/part/${partId}/upload`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    );

    await loadPartDocuments(partId);
    return data;
  }

  async function deletePartDocument(partId: string, documentId: string) {
    await axios.delete(`/documents/entities/part/${partId}/documents/${documentId}`);
    await loadPartDocuments(partId);
  }

  async function loadPartNotes(partId: string) {
    const { data } = await axios.get<MyPartNoteData[]>(`/parts/${partId}/notes`);
    notesByPartId.value = {
      ...notesByPartId.value,
      [partId]: data,
    };
    return data;
  }

  async function createPartNote(
    partId: string,
    payload: { text: string; priority: 'critical' | 'default' },
  ) {
    const { data } = await axios.post<MyPartNoteData>(`/parts/${partId}/notes`, payload);
    await loadPartNotes(partId);
    return data;
  }

  async function updatePartNote(
    partId: string,
    noteId: string,
    payload: { text: string; priority: 'critical' | 'default' },
  ) {
    const { data } = await axios.put<MyPartNoteData>(`/parts/${partId}/notes/${noteId}`, payload);
    await loadPartNotes(partId);
    return data;
  }

  async function deletePartNote(partId: string, noteId: string) {
    await axios.delete(`/parts/${partId}/notes/${noteId}`);
    await loadPartNotes(partId);
  }

  return {
    rawParts,
    parts,
    locations,
    loading,
    imagesByPartId,
    documentsByPartId,
    notesByPartId,
    lastId,
    fetch,
    setLastId,
    add,
    update,
    getPartImages,
    getPartDocuments,
    getPartNotes,
    loadPartImages,
    attachTempImageToPart,
    promotePartImage,
    deletePartImage,
    loadPartDocuments,
    uploadPartDocument,
    deletePartDocument,
    loadPartNotes,
    createPartNote,
    updatePartNote,
    deletePartNote,
    updatePartImage,
    updatePartImageIds,
    updatePartDocumentIds,
  };
});

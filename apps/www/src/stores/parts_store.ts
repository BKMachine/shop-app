import { defineStore } from 'pinia';
import { ref } from 'vue';
import axios from '@/plugins/axios';
import { socket } from '@/plugins/socket';

export const usePartStore = defineStore('parts', () => {
  const parts = ref<Part[]>([]);
  const listParts = ref<PartListItem[]>([]);
  const listTotal = ref(0);
  const listLimit = ref(20);
  const listOffset = ref(0);
  const listHasMore = ref(false);
  const listLoading = ref(false);
  const listLoadingMore = ref(false);
  const currentListQuery = ref<PartListFilters>({});
  const activeListRequestId = ref(0);
  const total = ref(0);

  const loading = ref(false);
  const imagesByPartId = ref<Record<string, MyImageData[]>>({});
  const documentsByPartId = ref<Record<string, MyDocumentData[]>>({});
  const notesByPartId = ref<Record<string, MyPartNoteData[]>>({});

  function updateRawPart(partId: string, updater: (part: Part) => void) {
    const index = parts.value.findIndex((part) => part._id === partId);
    const part = parts.value[index];
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

  function normalizeListQuery(query: PartListFilters): PartListFilters {
    return Object.fromEntries(
      Object.entries(query).filter(
        ([, value]) => value !== '' && value !== undefined && value !== null && value !== false,
      ),
    ) as PartListFilters;
  }

  async function fetchList(query: PartListFilters = {}, append = false) {
    const requestId = ++activeListRequestId.value;
    const nextQuery = normalizeListQuery(query);
    const nextLimit = Math.min(Math.max(Number(nextQuery.limit) || listLimit.value || 10, 1), 100);
    const nextOffset = append ? listParts.value.length : Math.max(Number(nextQuery.offset) || 0, 0);
    const requestQuery: PartListFilters = {
      ...nextQuery,
      limit: nextLimit,
      offset: nextOffset,
    };

    currentListQuery.value = requestQuery;

    if (append) listLoadingMore.value = true;
    else listLoading.value = true;

    try {
      const { data } = await axios.get<PartListResponse>('/parts', {
        params: requestQuery,
      });

      if (requestId !== activeListRequestId.value) {
        return;
      }

      if (append) {
        const existingIds = new Set(listParts.value.map((part) => part._id));
        listParts.value = [
          ...listParts.value,
          ...data.items.filter((part) => !existingIds.has(part._id)),
        ];
      } else {
        listParts.value = data.items;
      }

      listTotal.value = data.total;
      total.value = data.total;
      listLimit.value = data.limit;
      listOffset.value = data.offset;
      listHasMore.value = data.hasMore;
    } finally {
      if (requestId === activeListRequestId.value) {
        if (append) listLoadingMore.value = false;
        else listLoading.value = false;
      }
    }
  }

  function resetList() {
    activeListRequestId.value++;
    listParts.value = [];
    listTotal.value = 0;
    listOffset.value = 0;
    listHasMore.value = false;
    currentListQuery.value = {};
    listLoading.value = false;
    listLoadingMore.value = false;
  }

  async function fetchNextListPage() {
    if (listLoading.value || listLoadingMore.value || !listHasMore.value) return;
    await fetchList(currentListQuery.value, true);
  }

  function refreshListIfLoaded() {
    if (!listParts.value.length && !Object.keys(currentListQuery.value).length) {
      return;
    }

    void fetchList(currentListQuery.value);
  }

  const lastId = ref<string | null>(null);
  function setLastId(id: string | null) {
    lastId.value = id;
  }

  function getRelatedEntityId(value: string | { _id: string } | undefined | null) {
    if (!value) return undefined;
    return typeof value === 'string' ? value : value._id;
  }

  function toPartCreatePayload(part: Part | PartCreate): PartCreate {
    return {
      customer: getRelatedEntityId(part.customer) ?? '',
      part: part.part,
      description: part.description,
      stock: part.stock,
      location: part.location,
      position: part.position,
      productLink: part.productLink,
      partFilesPath: part.partFilesPath,
      revision: part.revision,
      material: getRelatedEntityId(part.material),
      customerSuppliedMaterial: part.customerSuppliedMaterial,
      materialCutType: part.materialCutType,
      materialLength: part.materialLength,
      barLength: part.barLength,
      remnantLength: part.remnantLength,
      cycleTimes: (part.cycleTimes || []).map((cycle) => ({
        operation: cycle.operation,
        time: Number(cycle.time) || 0,
      })),
      additionalCosts: (part.additionalCosts || []).map((cost) => ({
        name: cost.name,
        cost: Math.max(0, Number(cost.cost) || 0),
        url: cost.url,
      })),
      price: part.price,
      subComponentIds: (part.subComponentIds || []).map((subComponent) => ({
        partId: String(subComponent.partId),
        qty: Math.max(1, Number(subComponent.qty) || 1),
      })),
    };
  }

  function toPartUpdatePayload(part: Part | PartUpdate): PartUpdate {
    return {
      ...toPartCreatePayload(part),
      _id: part._id,
      __v: '__v' in part ? part.__v : undefined,
    };
  }

  async function add(part: Part | PartCreate) {
    await axios.post<Part>('/parts', { data: toPartCreatePayload(part) }).then(({ data }) => {
      parts.value.push(data);
      refreshListIfLoaded();
    });
  }

  async function update(part: Part | PartUpdate) {
    return axios.put<Part>('/parts', { data: toPartUpdatePayload(part) }).then(({ data }) => {
      const index = parts.value.findIndex((x) => x._id === data._id);
      if (index > -1) parts.value[index] = data;
      refreshListIfLoaded();
      return data;
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
    updatePartImage(partId, data.find((image) => image.isMain)?.url || '');
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
    const { data } = await axios.get<MyDocumentData[]>(
      `/documents/entities/part/${partId}/documents`,
    );
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

  const trigger = ref({ partID: '' });

  function SOCKET_part(part: Part) {
    const index = parts.value.findIndex((x) => x._id === part._id);
    if (index > -1) {
      parts.value[index] = part;
      refreshListIfLoaded();
      trigger.value.partID = part._id;
      setTimeout(() => {
        trigger.value.partID = '';
      }, 500);
    }
  }

  socket.on('part', (part: Part) => {
    SOCKET_part(part);
  });

  socket.on('customer', (customer: Customer) => {
    parts.value
      .filter((part) => part.customer?._id === customer._id)
      .forEach((part) => {
        part.customer = customer;
      });
  });

  socket.on('material', (material: Material) => {
    parts.value
      .filter((part) => part.material?._id === material._id)
      .forEach((part) => {
        part.material = material;
      });
  });

  return {
    parts,
    listParts,
    loading,
    total,
    listTotal,
    listLimit,
    listOffset,
    listHasMore,
    listLoading,
    listLoadingMore,
    currentListQuery,
    imagesByPartId,
    documentsByPartId,
    notesByPartId,
    lastId,
    trigger,
    fetchList,
    fetchNextListPage,
    resetList,
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
    SOCKET_part,
  };
});

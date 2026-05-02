import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import api from '@/plugins/axios';
import { socket } from '@/plugins/socket';
import { toastError, toastSuccess } from '@/plugins/vue-toast-notification';

type ShipmentListQuery = {
  from?: string;
  to?: string;
  customer?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

type ShipmentImageDeleteResponse = {
  success: boolean;
  id: string;
  entityType: string;
  entityId: string;
  nextMainImageId?: string;
  nextMainImageUrl?: string;
};

type AttachShipmentImageOptions = {
  skipOcr?: boolean;
};

type RunShipmentImageOcrOptions = {
  silent?: boolean;
};

export const useShipmentsStore = defineStore('shipments', () => {
  const _shipments = ref<Shipment[]>([]);
  const total = ref(0);
  const loading = ref(false);
  const limit = ref(80);
  const offset = ref(0);
  const hasMore = ref(false);
  const imagesByShipmentId = ref<Record<string, MyImageData[]>>({});
  const currentQuery = ref<ShipmentListQuery>({});

  const shipments = computed(() => [..._shipments.value]);

  async function fetch(query: ShipmentListQuery = {}, append = false) {
    const nextLimit = Math.min(Math.max(Number(query.limit) || limit.value, 1), 200);
    const nextOffset = append ? _shipments.value.length : Math.max(Number(query.offset) || 0, 0);
    const requestQuery = {
      ...query,
      limit: nextLimit,
      offset: nextOffset,
    };

    currentQuery.value = requestQuery;
    loading.value = true;

    try {
      const { data } = await api.get<ShipmentListResponse>('/shipments', {
        params: requestQuery,
      });

      if (append) {
        const existingIds = new Set(_shipments.value.map((shipment) => shipment._id));
        _shipments.value = [
          ..._shipments.value,
          ...data.items.filter((shipment) => !existingIds.has(shipment._id)),
        ];
      } else {
        _shipments.value = data.items;
      }

      total.value = data.total;
      limit.value = data.limit;
      offset.value = data.offset;
      hasMore.value = data.hasMore;
    } catch (err) {
      toastError('Failed to load shipments');
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function refresh() {
    await fetch(currentQuery.value);
  }

  async function fetchNextPage() {
    if (loading.value || !hasMore.value) return;
    await fetch(currentQuery.value, true);
  }

  async function create(shipment: ShipmentCreate, tempImageIds: string[] = []) {
    try {
      const { data } = await api.post<Shipment>('/shipments', { shipment });

      for (const imageId of tempImageIds) {
        await api.post<MyImageData>(`/images/uploads/${imageId}/attach`, {
          entityType: 'shipment',
          entityId: data._id,
          setAsMain: false,
          skipOcr: true,
        });
      }

      await refresh();
      if (tempImageIds.length) await loadImages(data._id);
      toastSuccess('Shipment archived');
      return data;
    } catch (err) {
      toastError('Failed to create shipment');
      throw err;
    }
  }

  async function update(shipment: ShipmentUpdate) {
    try {
      const { data } = await api.put<Shipment>('/shipments', { shipment });
      upsertShipment(data);
      toastSuccess('Shipment updated');
      return data;
    } catch (err) {
      toastError('Failed to update shipment');
      throw err;
    }
  }

  async function remove(shipmentId: string) {
    try {
      await api.delete(`/shipments/${shipmentId}`);
      removeLocalShipment(shipmentId);
      toastSuccess('Shipment removed');
    } catch (err) {
      toastError('Failed to remove shipment');
      throw err;
    }
  }

  async function loadImages(shipmentId: string) {
    const { data } = await api.get<MyImageData[]>(`/images/entities/shipment/${shipmentId}/images`);
    imagesByShipmentId.value = {
      ...imagesByShipmentId.value,
      [shipmentId]: data,
    };
    updateShipmentImageIds(
      shipmentId,
      data.map((image) => image.id),
    );
    return data;
  }

  function getImages(shipmentId: string) {
    return imagesByShipmentId.value[shipmentId] || [];
  }

  async function attachTempImage(
    shipmentId: string,
    imageId: string,
    options: AttachShipmentImageOptions = {},
  ) {
    const { data } = await api.post<MyImageData>(`/images/uploads/${imageId}/attach`, {
      entityType: 'shipment',
      entityId: shipmentId,
      setAsMain: false,
      skipOcr: options.skipOcr ?? true,
    });
    await loadImages(shipmentId);
    await refresh();
    return data;
  }

  async function deleteImage(shipmentId: string, imageId: string) {
    const { data } = await api.delete<ShipmentImageDeleteResponse>(
      `/images/entities/shipment/${shipmentId}/images/${imageId}`,
    );
    await loadImages(shipmentId);
    await refresh();
    return data;
  }

  async function rerunImageOcr(
    shipmentId: string,
    imageId: string,
    options: RunShipmentImageOcrOptions = {},
  ) {
    try {
      const { data } = await api.post<MyImageData>(
        `/images/entities/shipment/${shipmentId}/images/${imageId}/ocr`,
      );
      await loadImages(shipmentId);
      if (!options.silent) toastSuccess('OCR updated');
      return data;
    } catch (err) {
      toastError('Failed to run OCR');
      throw err;
    }
  }

  function updateShipmentImageIds(shipmentId: string, imageIds: string[]) {
    const shipment = _shipments.value.find((candidate) => candidate._id === shipmentId);
    if (shipment) shipment.imageIds = imageIds;
  }

  function removeLocalShipment(shipmentId: string) {
    const nextShipments = _shipments.value.filter((shipment) => shipment._id !== shipmentId);
    if (nextShipments.length === _shipments.value.length) return;

    _shipments.value = nextShipments;
    total.value = Math.max(total.value - 1, 0);
    delete imagesByShipmentId.value[shipmentId];
  }

  function upsertShipment(shipment: Shipment) {
    const index = _shipments.value.findIndex((candidate) => candidate._id === shipment._id);
    if (index > -1) _shipments.value[index] = shipment;
    else _shipments.value.unshift(shipment);
  }

  socket.on('shipment', (shipment: Shipment) => {
    upsertShipment(shipment);
  });

  socket.on('shipmentDeleted', (data: { id: string }) => {
    removeLocalShipment(data.id);
  });

  return {
    shipments,
    loading,
    total,
    limit,
    offset,
    hasMore,
    imagesByShipmentId,
    fetch,
    fetchNextPage,
    refresh,
    create,
    update,
    remove,
    loadImages,
    getImages,
    attachTempImage,
    deleteImage,
    rerunImageOcr,
  };
});

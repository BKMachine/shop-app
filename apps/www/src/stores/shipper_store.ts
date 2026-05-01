import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import api from '@/plugins/axios';
import { socket } from '@/plugins/socket';
import { toastError, toastSuccess } from '@/plugins/vue-toast-notification';

export const useShipperStore = defineStore('shippers', () => {
  const _shippers = ref<Shipper[]>([]);

  const shippers = computed(() => {
    return [..._shippers.value].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );
  });

  function fetch() {
    api.get<Shipper[]>('/shippers').then(({ data }) => {
      _shippers.value = data;
    });
  }

  async function add(shipper: ShipperCreate) {
    await api
      .post<Shipper>('/shippers', { shipper })
      .then(({ data }) => {
        upsertShipper(data);
        toastSuccess('Shipper added successfully');
      })
      .catch(() => {
        toastError('Failed to add shipper. Please try again.');
      });
  }

  async function update(shipper: ShipperUpdate) {
    await api
      .put<Shipper>('/shippers', { shipper })
      .then(({ data }) => {
        upsertShipper(data);
        toastSuccess('Shipper updated successfully');
      })
      .catch(() => {
        toastError('Failed to update shipper. Please try again.');
      });
  }

  function updateShipperLogo(shipperId: string, logo: string) {
    const index = _shippers.value.findIndex((shipper) => shipper._id === shipperId);
    const shipper = _shippers.value[index];
    if (shipper) shipper.logo = logo;
  }

  async function removeShipperLogo(shipperId: string) {
    return api
      .delete(`/images/entities/shipper/${shipperId}/image`)
      .then(() => {
        updateShipperLogo(shipperId, '');
        toastSuccess('Shipper logo removed successfully');
        return true;
      })
      .catch(() => {
        toastError('Failed to remove shipper logo');
        return false;
      });
  }

  function upsertShipper(shipper: Shipper) {
    const index = _shippers.value.findIndex((x) => x._id === shipper._id);
    if (index > -1) _shippers.value[index] = shipper;
    else _shippers.value.push(shipper);
  }

  socket.on('shipper', (shipper: Shipper) => {
    upsertShipper(shipper);
  });

  return {
    _shippers,
    shippers,
    fetch,
    add,
    update,
    removeShipperLogo,
    updateShipperLogo,
  };
});

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import api from '@/plugins/axios';
import { socket } from '@/plugins/socket';

export const useMaterialsStore = defineStore('materials', () => {
  const _materials = ref<Material[]>([]);

  const materials = computed<Material[]>(() => {
    return [..._materials.value];
  });

  const loading = ref(false);

  function fetch() {
    loading.value = true;
    api
      .get<Material[]>('/materials')
      .then(({ data }) => {
        _materials.value = data;
      })
      .finally(() => {
        loading.value = false;
      });
  }

  async function add(material: MaterialCreate): Promise<Material> {
    const { data } = await api.post<Material>('/materials', { material });
    upsertMaterial(data);
    return data;
  }

  async function update(material: MaterialUpdate) {
    await api.put<Material>('/materials', { material }).then(({ data }) => {
      upsertMaterial(data);
    });
  }

  function upsertMaterial(material: Material) {
    const index = _materials.value.findIndex((x) => x._id === material._id);
    if (index > -1) _materials.value[index] = material;
    else _materials.value.push(material);
  }

  socket.on('material', (material: Material) => {
    upsertMaterial(material);
  });

  socket.on('supplier', (supplier: Supplier) => {
    _materials.value
      .filter((material) => material.supplier._id === supplier._id)
      .forEach((material) => {
        material.supplier = supplier;
      });
  });

  return {
    materials,
    loading,
    fetch,
    add,
    update,
  };
});

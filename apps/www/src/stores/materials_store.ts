import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import api from '@/plugins/axios';
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

  async function add(material: Material): Promise<Material> {
    const { data } = await api.post<Material>('/materials', { material });
    _materials.value.push(data);
    return data;
  }

  async function update(material: Material) {
    const payload = {
      ...material,
      supplier: material.supplier._id,
    };
    await api.put<Material>('/materials', { material: payload }).then(({ data }) => {
      const index = _materials.value.findIndex((x) => x._id === data._id);
      if (index > -1) _materials.value[index] = data;
    });
  }

  return {
    materials,
    loading,
    fetch,
    add,
    update,
  };
});

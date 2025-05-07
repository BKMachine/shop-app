import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import axios from '@/plugins/axios';
import { useSupplierStore } from '@/stores/supplier_store';

export const useMaterialsStore = defineStore('materials', () => {
  const supplierStore = useSupplierStore();

  const rawMaterials = ref<Material[]>([]);

  const materials = computed<Material[]>(() => {
    return rawMaterials.value.map((x) => {
      return {
        ...x,
        supplier: supplierStore.suppliers.find((y) => y._id === x.supplier),
      };
    });
  });

  const loading = ref(false);
  function fetch() {
    loading.value = true;
    axios
      .get<Material[]>('/materials')
      .then(({ data }) => {
        rawMaterials.value = data;
      })
      .finally(() => {
        loading.value = false;
      });
  }

  async function add(material: Material) {
    const { _id, ...rest } = material;
    await axios.post<Material>('/materials', { data: rest }).then(({ data }) => {
      rawMaterials.value.push(data);
    });
  }

  async function update(material: Material) {
    await axios.put<Material>('/materials', { data: material }).then(({ data }) => {
      const index = rawMaterials.value.findIndex((x) => x._id === data._id);
      if (index > -1) rawMaterials.value[index] = data;
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

import { defineStore } from 'pinia';
import { ref } from 'vue';
import axios from '@/plugins/axios';

export const useScannerStore = defineStore('scanner', () => {
  const dialog = ref(false);
  const code = ref<string>('');
  const type = ref<'404' | 'tool'>('404');
  const stockAdjustment = ref(0);
  const tool = ref<ToolDoc_Pop>({} as ToolDoc_Pop);

  function showDialog(bool: boolean) {
    dialog.value = bool;
  }

  async function scan(scanCode: string) {
    code.value = scanCode;
    axios
      .get(`/tools/info/${scanCode}`)
      .then(({ data }) => {
        type.value = 'tool';
        tool.value = data;
      })
      .catch(() => {
        type.value = '404';
      })
      .finally(() => {
        showDialog(true);
      });
  }

  function setStockAdjustment(num: number) {
    stockAdjustment.value = num;
  }

  function incrementStockAdjustment() {
    stockAdjustment.value++;
  }

  function decrementStockAdjustment() {
    stockAdjustment.value--;
  }

  return {
    dialog,
    code,
    type,
    stockAdjustment,
    tool,
    showDialog,
    scan,
    setStockAdjustment,
    incrementStockAdjustment,
    decrementStockAdjustment,
  };
});

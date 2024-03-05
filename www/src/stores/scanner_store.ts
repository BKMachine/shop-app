import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useToolStore } from '@/stores/tool_store';

export const useScannerStore = defineStore('scanner', () => {
  const toolStore = useToolStore();

  const dialog = ref(false);
  const code = ref<string>('');
  const type = ref<'404' | 'tool'>('404');
  const stockAdjustment = ref(0);

  function showDialog(bool: boolean) {
    dialog.value = bool;
  }

  function scan(scanCode: string) {
    code.value = scanCode;
    const tool = getTool();
    if (tool) type.value = 'tool';
    else type.value = '404';
    showDialog(true);
  }

  function getTool() {
    return toolStore.tools.find((x) => x.item === code.value || x.barcode === code.value);
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
    showDialog,
    scan,
    getTool,
    setStockAdjustment,
    incrementStockAdjustment,
    decrementStockAdjustment,
  };
});

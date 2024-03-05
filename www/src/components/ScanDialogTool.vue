<template>
  <div>
    <v-avatar class="avatar" size="150">
      <img :src="tool.img" class="tool-img" alt="" />
    </v-avatar>
    <v-card class="card">
      <v-card-title class="text-right">
        <div>{{ tool.item }}</div>
        <div>{{ tool.description }}</div>
        <div>{{ tool.stock }} in stock</div>
      </v-card-title>
      <v-card-text class="card-body">
        <div class="mb-8">
          <v-btn class="v-arrow-select" :disabled="tool.stock === 0" @click="adjustStock(-1)">
            <div class="barcode-container">
              <div>Pick Tool</div>
              <div class="barcode">
                <BarcodeGenerator :code="scanCodes.PICK_TOOL" :showText="false" />
              </div>
            </div>
          </v-btn>
        </div>
        <div class="mb-8">
          <v-btn class="v-arrow-select" @click="adjustStock(scannerStore.stockAdjustment)">
            <div class="barcode-container">
              <div>Adjust Stock</div>
              <div class="barcode">
                <BarcodeGenerator :code="scanCodes.ADJUST_STOCK" :showText="false" />
              </div>
            </div>
          </v-btn>
          <div class="stock-adjust-container mt-2">
            <v-btn class="h-arrow-select" icon="mdi-minus" @mousedown.left="arrowLeft"></v-btn>
            <div class="stack-adjust-number">{{ stockAdjustText }}</div>
            <v-btn class="h-arrow-select" icon="mdi-plus" @mousedown.left="arrowRight"></v-btn>
          </div>
        </div>
        <div>
          <v-btn class="v-arrow-select" @click="openDetails">
            <div class="barcode-container">
              <div>View Details</div>
              <div class="barcode">
                <BarcodeGenerator :code="scanCodes.VIEW_DETAILS" :showText="false" />
              </div>
            </div>
          </v-btn>
        </div>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import BarcodeGenerator from '@/components/BarcodeGenerator.vue';
import { scanCodes } from '@/plugins/enums';
import router from '@/router';
import { useScannerStore } from '@/stores/scanner_store';
import { useToolStore } from '@/stores/tool_store';

const toolStore = useToolStore();
const scannerStore = useScannerStore();

const stockAdjustText = computed(() => {
  if (scannerStore.stockAdjustment > 0) return `+${scannerStore.stockAdjustment}`;
  else return scannerStore.stockAdjustment;
});

const tool = computed(() => {
  return scannerStore.getTool() as ToolDoc;
});

async function adjustStock(num: number) {
  await toolStore.adjustStock(tool.value._id, num);
  scannerStore.setStockAdjustment(0);
  close();
}

function openDetails() {
  close();
  router.push({ name: 'viewTool', params: { id: tool.value._id } });
}

function close() {
  scannerStore.showDialog(false);
}

let vButtons: NodeListOf<HTMLElement>;
let hButtons: NodeListOf<HTMLElement>;

onMounted(() => {
  addEventListener('keydown', handleKeydown);
  vButtons = document.querySelectorAll('.v-arrow-select');
  hButtons = document.querySelectorAll('.h-arrow-select');
  let buttonToFocus = vButtons[0];
  if (buttonToFocus.getAttribute('disabled') === '') buttonToFocus = vButtons[1];
  buttonToFocus.focus();
});

onUnmounted(() => {
  removeEventListener('keydown', handleKeydown);
});

function handleKeydown(e: KeyboardEvent) {
  let index = findVerticalIndex();
  const pickIsDisabled = vButtons[0].getAttribute('disabled') === '';

  switch (e.key) {
    case 'ArrowUp':
      if (index === null || index - 1 < 0) index = vButtons.length - 1;
      else index--;
      if (index === 0 && pickIsDisabled) index = vButtons.length - 1;
      focusVButton(index);
      break;
    case 'ArrowDown':
      if (index === null || index + 1 >= vButtons.length) index = 0;
      else index++;
      if (index === 0 && pickIsDisabled) index++;
      focusVButton(index);
      break;
    case 'ArrowLeft':
      scannerStore.decrementStockAdjustment();
      focusVButton(1);
      break;
    case 'ArrowRight':
      scannerStore.incrementStockAdjustment();
      focusVButton(1);
      break;
  }
}

function findVerticalIndex(): number | null {
  if (!vButtons.length) return null;
  const activeElement = document.activeElement;
  for (let i = 0; i < vButtons.length; i++) {
    if (activeElement === vButtons[i]) return i;
  }
  return null;
}

function focusVButton(index: number | null) {
  if (index === null) return;
  (vButtons[index] as HTMLElement).focus();
}

function arrowRight(e: MouseEvent) {
  e.preventDefault();
  (vButtons[1] as HTMLElement).focus();
  scannerStore.incrementStockAdjustment();
}

function arrowLeft(e: MouseEvent) {
  e.preventDefault();
  (vButtons[1] as HTMLElement).focus();
  scannerStore.decrementStockAdjustment();
}
</script>

<style scoped>
.card {
  background: rgb(101, 108, 217);
  background: linear-gradient(
    -135deg,
    rgba(215, 218, 99, 1) 0%,
    rgba(215, 101, 101, 1) 55%,
    rgba(101, 108, 217, 1) 100%
  );
}
.card-body {
  display: flex;
  flex-direction: column;
}
.card-body > div {
  margin-left: auto;
  margin-right: auto;
}
.card-body .v-btn {
  width: 200px;
  height: 60px;
  border-radius: 20px;
  background: #f6f6f6;
}
.card-body .v-btn:focus {
  background: aquamarine;
}
.avatar {
  position: absolute;
  top: 0;
  left: 0;
  translate: -35% -35%;
  z-index: 1;
  border: 2px solid #545454;
  background: white;
}
.tool-img {
  width: 90%;
}
.stock-adjust-container {
  display: flex;
  align-items: center;
  margin-left: auto;
  margin-right: auto;
  width: 60%;
}
.stock-adjust-container .v-btn {
  border-radius: 5px;
  height: 24px;
  width: 24px;
}
.stack-adjust-number {
  flex-grow: 1;
  text-align: center;
  font-size: 2em;
}
.barcode-container {
  display: flex;
  flex-direction: column;
}
.barcode {
  position: absolute;
  bottom: -10px;
  left: 0;
  right: 0;
}
</style>

<template>
  <div class="tool-dialog">
    <v-avatar class="avatar" size="132"> <img alt="" :src="tool.img" /> </v-avatar>
    <v-card class="card">
      <v-card-title class="card-title">
        <div class="eyebrow">Tool Match</div>
        <div class="item-id">
          <span v-if="brandName" class="item-prefix">{{ brandName }}</span>
          <span>{{ tool.item }}</span>
        </div>
        <div class="description">{{ tool.description }}</div>
        <div class="meta-row">
          <div class="inventory-pill">{{ tool.stock }}&nbsp;in stock</div>
        </div>
        <div class="location">
          <span v-if="tool.location">{{ tool.location }}</span>
          <span v-if="tool.position"> | {{ tool.position }}</span>
        </div>
      </v-card-title>
      <v-card-text class="card-body">
        <div class="mb-8 mt-2">
          <v-btn
            class="v-arrow-select action-button"
            :disabled="tool.stock === 0"
            @click="pickTool"
          >
            Pick Tool
          </v-btn>
        </div>
        <div class="mb-8 adjust-stock-block">
          <v-btn
            :class="['h-arrow-select stock-button', { 'stock-button--pressed': activeAdjustButton === 'left' }]"
            icon="mdi-minus"
            @mousedown.left="arrowLeft"
          />
          <v-btn
            :aria-label="adjustButtonAriaLabel"
            class="v-arrow-select action-button"
            @click="adjustStock(scannerStore.stockAdjustment)"
          >
            <span v-if="scannerStore.stockAdjustment !== 0" class="adjust-value">
              {{ stockAdjustText }}
            </span>
            <span v-else>Adjust Stock</span>
          </v-btn>
          <v-btn
            :class="['h-arrow-select stock-button', { 'stock-button--pressed': activeAdjustButton === 'right' }]"
            icon="mdi-plus"
            @mousedown.left="arrowRight"
          />
        </div>
        <div>
          <v-btn class="v-arrow-select action-button" @click="openDetails"> View Details </v-btn>
        </div>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import router from '@/router';
import { useScannerStore } from '@/stores/scanner_store';
import { useToolStore } from '@/stores/tool_store';

const toolStore = useToolStore();
const scannerStore = useScannerStore();
let vButtons: NodeListOf<HTMLElement>;
const activeAdjustButton = ref<'left' | 'right' | null>(null);
let adjustButtonAnimationTimeout: ReturnType<typeof setTimeout> | null = null;

const tool = computed(() => scannerStore.tool);

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
  vButtons = document.querySelectorAll('.v-arrow-select');
  // choose the first available button (fallback to the second) and only focus if it exists
  const buttonToFocus = vButtons[0] ?? vButtons[1];
  if (buttonToFocus) buttonToFocus.focus();
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
  clearAdjustButtonAnimation();
});

const stockAdjustText = computed(() => {
  if (scannerStore.stockAdjustment > 0) return `+${scannerStore.stockAdjustment}`;
  else return scannerStore.stockAdjustment;
});

const brandName = computed(() => {
  return tool.value.vendor?.name?.trim() || '';
});

const adjustButtonAriaLabel = computed(() => {
  return scannerStore.stockAdjustment === 0
    ? 'Adjust stock'
    : `Adjust stock ${stockAdjustText.value}`;
});

async function pickTool() {
  await toolStore.pickTool(scannerStore.code);
  close();
}

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

function handleKeydown(e: KeyboardEvent) {
  let index = findVerticalIndex();
  const pickIsDisabled = vButtons?.[0]?.getAttribute('disabled') === '';

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
      pulseAdjustButton('left');
      scannerStore.decrementStockAdjustment();
      focusVButton(1);
      break;
    case 'ArrowRight':
      pulseAdjustButton('right');
      scannerStore.incrementStockAdjustment();
      focusVButton(1);
      break;
  }
}

function clearAdjustButtonAnimation() {
  if (adjustButtonAnimationTimeout) {
    clearTimeout(adjustButtonAnimationTimeout);
    adjustButtonAnimationTimeout = null;
  }
  activeAdjustButton.value = null;
}

function pulseAdjustButton(direction: 'left' | 'right') {
  clearAdjustButtonAnimation();
  activeAdjustButton.value = direction;
  adjustButtonAnimationTimeout = setTimeout(() => {
    activeAdjustButton.value = null;
    adjustButtonAnimationTimeout = null;
  }, 140);
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
  pulseAdjustButton('right');
  (vButtons[1] as HTMLElement).focus();
  scannerStore.incrementStockAdjustment();
}

function arrowLeft(e: MouseEvent) {
  e.preventDefault();
  pulseAdjustButton('left');
  (vButtons[1] as HTMLElement).focus();
  scannerStore.decrementStockAdjustment();
}
</script>

<style scoped>
.tool-dialog {
  position: relative;
  padding-top: 24px;
}

.card {
  overflow: hidden;
  padding: 24px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 28px;
  background:
    radial-gradient(circle at top right, rgba(251, 191, 36, 0.34), transparent 34%),
    radial-gradient(circle at bottom left, rgba(59, 130, 246, 0.24), transparent 36%),
    linear-gradient(145deg, #18212f 0%, #0f1724 100%);
  color: #f8fafc;
  box-shadow: 0 28px 70px rgba(15, 23, 36, 0.45);
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.card-body > div {
  margin-left: auto;
  margin-right: auto;
  width: 100%;
  display: flex;
  justify-content: center;
}

.card-body .v-btn {
  width: 220px;
  min-height: 56px;
  border-radius: 18px;
  letter-spacing: 0.02em;
  text-transform: none;
}

.card-body .v-btn:focus {
  outline: 3px solid rgba(96, 165, 250, 0.7);
  outline-offset: 2px;
}

.avatar {
  position: absolute;
  top: 0;
  left: 0;
  translate: -18% -18%;
  z-index: 1;
  border: 4px solid rgba(255, 255, 255, 0.88);
  background: linear-gradient(180deg, #ffffff 0%, #e2e8f0 100%);
  box-shadow: 0 20px 40px rgba(15, 23, 36, 0.3);
}

.avatar img {
  max-width: 90%;
  max-height: 90%;
}

.location {
  margin-top: 12px;
  font-size: 0.9rem;
  color: rgba(226, 232, 240, 0.82);
}

.card-title {
  padding: 8px 8px 28px 132px;
  text-align: right;
  line-height: 1.35;
}

.adjust-stock-block {
  align-items: center;
  gap: 12px;
}

.meta-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-top: 16px;
}

.eyebrow {
  margin-bottom: 10px;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #fbbf24;
}

.item-id {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: flex-end;
  gap: 0.3rem;
  font-size: clamp(1.6rem, 4vw, 2rem);
  font-weight: 800;
}

.item-prefix {
  color: #fbbf24;
  font-size: clamp(0.78rem, 1.7vw, 0.98rem);
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
}

.brand {
  margin-top: 8px;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgba(148, 163, 184, 0.95);
}

.description {
  margin-top: 8px;
  font-size: 1.2rem;
  color: rgba(248, 250, 252, 0.94);
}

.inventory-pill {
  display: inline-flex;
  padding: 8px 14px;
  border: 1px solid rgba(250, 204, 21, 0.32);
  border-radius: 999px;
  background: rgba(250, 204, 21, 0.16);
  font-size: 1rem;
  font-weight: 700;
  color: #fde68a;
}

.action-button {
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: rgba(255, 255, 255, 0.08);
  color: #f8fafc;
  box-shadow: 0 12px 26px rgba(8, 15, 28, 0.22);
}

.stock-button {
  background: rgba(255, 255, 255, 0.1);
  color: #f8fafc;
  transition:
    transform 120ms ease,
    background-color 120ms ease,
    box-shadow 120ms ease;
}

.adjust-stock-block .action-button {
  width: 220px;
  white-space: nowrap;
}

.adjust-stock-block .stock-button {
  width: 48px;
  min-width: 48px;
  min-height: 48px;
  border-radius: 14px;
  flex: 0 0 48px;
}

.stock-button--pressed {
  transform: translateY(1px) scale(0.96);
  background: rgba(251, 191, 36, 0.24);
  box-shadow: inset 0 2px 8px rgba(15, 23, 36, 0.28);
}

.adjust-value {
  font-size: 1.45rem;
  font-weight: 700;
  letter-spacing: 0.03em;
}

.action-button:focus,
.action-button:focus-visible {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: #111827;
  border-color: transparent;
}

@media (max-width: 600px) {
  .tool-dialog {
    padding-top: 20px;
  }

  .card {
    padding: 20px 16px 16px;
  }

  .card-title {
    padding: 104px 8px 24px;
    text-align: left;
  }

  .item-id {
    justify-content: flex-start;
  }

  .inventory-pill {
    align-self: flex-start;
  }

  .adjust-stock-block .action-button {
    width: 180px;
  }

  .meta-row {
    justify-content: flex-start;
  }

  .avatar {
    left: 50%;
    translate: -50% -10%;
  }
}

@media (min-width: 601px) {
  .adjust-stock-block {
    flex-direction: row;
    justify-content: center;
  }
}
</style>

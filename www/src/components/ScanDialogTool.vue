<template>
  <div class="container">
    <v-avatar class="avatar" size="150">
      <img :src="tool.img" class="tool-img" />
    </v-avatar>
    <v-card class="card">
      <v-card-title class="text-right">
        <div class="title">{{ tool.item }}</div>
        <div>{{ tool.description }}</div>
        <div>{{ tool.stock }} in stock</div>
      </v-card-title>
      <v-card-text class="card-body">
        <div>
          <v-btn class="v-arrow-select" :disabled="tool.stock === 0" @click="adjustStock(-1)">
            Pick Tool
          </v-btn>
        </div>
        <div>
          <v-btn class="v-arrow-select" @click="adjustStock(stockAdjustment)"> Adjust Stock </v-btn>
          <div class="stock-adjust-container">
            <v-btn class="h-arrow-select" icon="mdi-minus" @click="stockAdjustment--"></v-btn>
            <div class="stack-adjust-number">{{ stockAdjustText }}</div>
            <v-btn class="h-arrow-select" icon="mdi-plus" @click="stockAdjustment++"></v-btn>
          </div>
        </div>
        <div>
          <v-btn class="v-arrow-select" @click="details"> View Details </v-btn>
        </div>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import router from '@/router';
import { useToolStore } from '@/stores/tool_store';

const props = defineProps<{
  scanCode: string;
}>();
const emit = defineEmits(['close']);

const toolStore = useToolStore();
const stockAdjustment = ref(0);
const adjustDialog = ref(false);

const stockAdjustText = computed(() => {
  if (stockAdjustment.value > 0) return `+${stockAdjustment.value}`;
  else return stockAdjustment.value;
});

const tool = computed(() => {
  return (toolStore.tools.find((x) => x.item === props.scanCode || x.barcode === props.scanCode) ||
    {}) as ToolDoc;
});

async function adjustStock(num: number) {
  await toolStore.adjustStock(tool.value._id, num);
  stockAdjustment.value = 0;
  close();
}

function details() {
  close();
  router.push({ name: 'viewTool', params: { id: tool.value._id } });
}

function close() {
  adjustDialog.value = false;
  emit('close');
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
  let index: number | undefined;
  const pickIsDisabled = vButtons[0].getAttribute('disabled') === '';

  function handleVButtons() {
    if (!vButtons.length) return;
    const activeElement = document.activeElement;
    for (let i = 0; i < vButtons.length; i++) {
      if (activeElement === vButtons[i]) {
        index = i;
        break;
      }
    }
  }

  switch (e.key) {
    case 'ArrowDown':
      handleVButtons();
      if (index === undefined || index + 1 >= vButtons.length) index = 0;
      else index++;
      if (index === 0 && pickIsDisabled) index++;
      focusVButton();
      break;
    case 'ArrowUp':
      handleVButtons();
      if (index === undefined || index - 1 < 0) index = vButtons.length - 1;
      else index--;
      if (index === 0 && pickIsDisabled) index = vButtons.length - 1;
      focusVButton();
      break;
    case 'ArrowRight':
      stockAdjustment.value++;
      animateButton(1);
      break;
    case 'ArrowLeft':
      stockAdjustment.value--;
      animateButton(0);
      break;
  }

  function focusVButton() {
    if (index === undefined) return;
    (vButtons[index] as HTMLElement).focus();
  }

  function animateButton(index: number) {
    hButtons[index].classList.add('animate');
    setTimeout(() => {
      hButtons[index].classList.remove('animate');
    }, 10);
  }
}
</script>

<style scoped>
.container {
  position: relative;
}
.card {
  background: rgb(101, 108, 217);
  background: linear-gradient(
    315deg,
    rgba(101, 108, 217, 1) 0%,
    rgba(215, 101, 101, 1) 64%,
    rgba(215, 218, 99, 1) 100%
  );
}
.card-body {
  display: flex;
  flex-direction: column;
}
.card-body > div {
  margin: 16px auto;
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
  transform: translate(-35%, -35%);
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
  margin-right: autO;
  margin-top: 5px;
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
.h-arrow-select.animate {
  animation: flash 200ms;
}
@keyframes flash {
  0% {
    background: #f6f6f6;
  }
  50% {
    background: #85c714;
  }
  100% {
    background: #f6f6f6;
  }
}
</style>

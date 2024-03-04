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
        <v-btn class="" :disabled="tool.stock === 0" @click="adjustStock(-1)"> Pick Tool </v-btn>

        <v-btn class="" @click="adjustDialog = true">
          <div>Adjust Stock</div>
        </v-btn>

        <!--        <v-dialog v-model="adjustDialog">
          <template v-slot:activator>
            <v-btn class="add" @click="adjustDialog = true">
              <div>Adjust Stock</div>
            </v-btn>
          </template>
          <v-card>
            <v-card-title> Adjust Stock </v-card-title>
            <v-card-text>
              <v-text-field v-model.number="stockAdjustment" type="number"></v-text-field>
            </v-card-text>
            <v-card-actions>
              <v-btn @click="adjustDialog = false">Cancel</v-btn>
              <v-btn @click="adjustStock(stockAdjustment)"> Submit </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>-->

        <v-btn class="" @click="details"> View Details </v-btn>
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

onMounted(() => {
  addEventListener('keydown', handleKeydown);
  const e = document.querySelector('.card-body');
  if (!e) return;
  let c = e.children[0] as HTMLElement;
  if (c.getAttribute('disabled') === '') c = e.children[1] as HTMLElement;
  c.focus();
});

onUnmounted(() => {
  removeEventListener('keydown', handleKeydown);
});

function handleKeydown(e: KeyboardEvent) {
  const cardBody = document.querySelector('.card-body');
  if (!cardBody) return;
  const activeElement = document.activeElement;
  let index: number | undefined;
  for (let i = 0; i < cardBody.children.length; i++) {
    if (activeElement === cardBody.children[i]) {
      index = i;
      break;
    }
  }

  const pickIsDisabled = cardBody.children[0].getAttribute('disabled') === '';

  switch (e.key) {
    case 'ArrowDown':
      if (index === undefined || index + 1 >= cardBody.children.length) index = 0;
      else index++;
      if (index === 0 && pickIsDisabled) index++;
      break;
    case 'ArrowUp':
      if (index === undefined || index - 1 < 0) index = cardBody.children.length - 1;
      else index--;
      if (index === 0 && pickIsDisabled) index = cardBody.children.length - 1;
      break;
  }

  if (index === undefined) return;
  (cardBody.children[index] as HTMLElement).focus();
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
.card-body .v-btn {
  width: 220px;
  height: 65px;
  border-radius: 20px;
  background: #f6f6f6;
  margin: 20px auto;
}
.card-body .v-btn:focus {
  background: aquamarine;
}
.card-body .v-btn:nth-child(2) {
  margin-bottom: 0;
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
</style>

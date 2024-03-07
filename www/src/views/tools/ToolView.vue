<template>
  <v-container>
    <v-row>
      <div class="header">
        <img class="tool-img" :src="tool.img" alt="" />
        <div class="stock-container">
          <div class="stock">
            {{ tool.stock }}
          </div>
          <div>In Stock</div>
        </div>
      </div>
    </v-row>
    <v-row>
      <v-btn color="green" variant="outlined" @click="save">Save</v-btn>
      <v-btn
        color="yellow"
        prepend-icon="mdi-link"
        variant="elevated"
        :disabled="!tool.productLink"
        @click="openLink(tool.productLink)"
      >
        Product Page
      </v-btn>
      <v-btn
        color="blue"
        prepend-icon="mdi-speedometer"
        variant="elevated"
        :disabled="!tool.techDataLink"
        @click="openLink(tool.techDataLink)"
      >
        Tech Data
      </v-btn>
      <v-switch v-model="tool.autoReorder" label="Auto Reorder" color="green"></v-switch>
    </v-row>
    <v-divider />
    <v-row class="my-4">
      <v-col cols="12">
        <v-text-field
          v-model.number="tool.cost"
          label="Cost"
          prepend-inner-icon="mdi-currency-usd"
        ></v-text-field>
        <v-text-field v-model="tool.description" label="Description"></v-text-field>
        <v-text-field
          v-model="tool.productLink"
          label="Product Page Link"
          append-inner-icon="mdi-link"
        ></v-text-field>
        <v-text-field
          v-model="tool.techDataLink"
          label="Speed & Feeds Link"
          append-inner-icon="mdi-link"
        ></v-text-field>
        <VendorSelect v-model="tool.vendor" />
        <v-text-field v-model="tool.item" label="EDP Order Number"></v-text-field>
        <v-text-field
          v-model="tool.barcode"
          label="Barcode"
          append-inner-icon="mdi-barcode"
        ></v-text-field>
        <v-text-field v-model.number="tool.stock" label="Stock Qty"></v-text-field>
        <v-text-field v-model="tool.img" label="Tool Image URL"></v-text-field>
        <v-select v-model="tool.coating" label="Coating" :items="coatings"></v-select>
        <v-text-field v-model.number="tool.flutes" :label="fluteText"></v-text-field>
        <v-text-field v-model.number="tool.reorderQty" label="Reorder Qty"></v-text-field>
        <v-text-field v-model.number="tool.reorderThreshold" label="Min Stock Qty"></v-text-field>
      </v-col>
    </v-row>
    <v-divider />
  </v-container>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onMounted, ref } from 'vue';
import VendorSelect from '@/components/VendorSelect.vue';
import axios from '@/plugins/axios';
import router from '@/router';
import { useToolStore } from '@/stores/tool_store';

const toolStore = useToolStore();

const tool = ref<ToolDoc | ToolDoc_Vendor>({} as ToolDoc_Vendor);

const category = ref<ToolCategory>('milling');

onBeforeMount(() => {
  const type = window.localStorage.getItem('type') as ToolCategory | null;
  category.value = type ? type : 'milling';
});

onMounted(() => {
  const routeName = router.currentRoute.value.name;
  if (routeName === 'viewTool') fetchTool();
});

const coatings = computed(() => {
  if (!tool.value.vendor) return [];
  if (typeof tool.value.vendor === 'string') return [];
  return tool.value.vendor.coatings;
});

function fetchTool() {
  const { id } = router.currentRoute.value.params;
  const match = toolStore.tools.find((x) => x._id === id);
  if (match) {
    tool.value = { ...match };
  } else {
    axios
      .get(`/tools/${id}`)
      .then(({ data }: { data: ToolDoc_Vendor }) => {
        tool.value = data;
      })
      .catch(() => {
        alert('Tool not found');
      });
  }
}

const fluteText = computed(() => {
  return category.value === 'milling' ? 'Flutes' : 'Cutting Edges';
});

async function save() {
  const routeName = router.currentRoute.value.name;
  if (routeName === 'createTool') {
    await toolStore.add({ ...(tool.value as ToolDoc), category: category.value });
  } else if (routeName === 'viewTool') {
    await toolStore.update(tool.value as ToolDoc_Vendor);
  }
  await router.push({ name: 'tools' });
}

function openLink(link: string | undefined) {
  if (!link) return;
  window.open(link, '_blank');
}
</script>

<style scoped>
.header {
  height: 160px;
  display: flex;
  justify-content: space-between;
  padding: 20px;
}
.stock-container {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  width: 120px;
  height: 120px;
  flex-direction: column;
}
.stock {
  font-weight: bolder;
  font-size: 3em;
}
</style>

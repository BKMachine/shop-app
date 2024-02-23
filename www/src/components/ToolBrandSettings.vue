<template>
  <div class="container">
    <v-btn
      v-for="(manufacturer, i) in toolStore.manufacturersSorted"
      :key="manufacturer._id"
      class="tile elevation-2"
      @click="edit(i)"
    >
      <v-img v-if="manufacturer.logo" :src="manufacturer.logo" class="logo"></v-img>
      <span v-else>{{ manufacturer.name }}</span>
    </v-btn>
    <v-btn class="tile elevation-2" color="primary" @click="create">
      <v-icon size="36">mdi-plus</v-icon>
    </v-btn>
  </div>
  <v-dialog v-model="dialog" class="dialog" @blur="close">
    <v-card>
      <v-card-title>{{ cardTitle }}</v-card-title>
      <v-card-text>
        <v-text-field
          v-model="editingItem.name"
          label="Name"
          :rules="[rules.required, rules.counter, rules.unique]"
        ></v-text-field>
        <div class="logo-container">
          <v-text-field
            v-model="editingItem.logo"
            label="Logo URL"
            :rules="[rules.required]"
          ></v-text-field>
          <v-img :src="editingItem.logo" class="logo-preview ml-3"></v-img>
        </div>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn color="red" variant="elevated" @click="close">Cancel</v-btn>
        <v-btn color="green" variant="elevated" @click="save">{{ actionText }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import axios from '@/plugins/axios';
import { useToolStore } from '@/stores/tool_store';

const toolStore = useToolStore();
const dialog = ref(false);
const defaultItem: ToolManufacturerDoc = { _id: '', name: '', logo: '' };
const editingIndex = ref(-1);
const editingItem = ref<ToolManufacturerDoc>(defaultItem);

const cardTitle = computed(() => {
  const prefix = editingIndex.value === -1 ? 'Add' : 'Edit';
  return prefix + ' Tool Manufacturer';
});

const actionText = computed(() => {
  return editingIndex.value === -1 ? 'Save' : 'Update';
});

function create() {
  editingIndex.value = -1;
  editingItem.value = { ...defaultItem };
  dialog.value = true;
}

function edit(i: number) {
  editingIndex.value = i;
  editingItem.value = toolStore.manufacturersSorted[editingIndex.value];
  dialog.value = true;
}

async function close() {
  dialog.value = false;
}

const names = computed(() => {
  return toolStore.manufacturers.map((x) => x.name.toLowerCase());
});

const rules: Rules = {
  required: (value) => !!value || 'Required',
  counter: (value) => value.length <= 20 || 'Max 20 characters',
  unique: (value) => !names.value.includes(value.toLowerCase()) || 'Name already used',
};

async function save() {
  if (editingIndex.value === -1) {
    await axios.post('/tools/manufacturer', { data: editingItem.value }).then(({ data }) => {
      toolStore.addManufacturer(data);
    });
  } else {
    await axios.put('/tools/manufacturer', { data: editingItem.value }).then(() => {
      toolStore.updateManufacturer(editingItem.value);
    });
  }
  dialog.value = false;
}
</script>

<style scoped>
.container {
  display: flex;
  flex-wrap: wrap;
}
.tile {
  width: 120px;
  height: 120px;
  border: 1px solid #999999;
  margin: 8px;
  border-radius: 20px;
  position: relative;
}
.logo {
  width: 100px;
  height: 100px;
}
.dialog {
  max-width: 700px;
}
.logo-container {
  display: flex;
  align-items: center;
}
.logo-preview {
  height: 80px;
  max-width: 80px;
  border: 1px solid #ababab;
  border-radius: 10px;
}
</style>

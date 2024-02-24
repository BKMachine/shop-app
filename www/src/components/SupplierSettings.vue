<template>
  <div class="container">
    <v-btn
      v-for="(supplier, i) in supplierStore.sorted"
      :key="supplier._id"
      class="tile elevation-2"
      @click="edit(i)"
    >
      <v-img v-if="supplier.logo" :src="supplier.logo" class="logo"></v-img>
      <span v-else>{{ supplier.name }}</span>
      <v-tooltip activator="parent" open-delay="500" location="top" offset="-20">
        {{ supplier.name }}
      </v-tooltip>
    </v-btn>
    <v-btn class="tile elevation-2" color="blue-lighten-2" @click="create">
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
          <v-text-field v-model="editingItem.logo" label="Logo URL"></v-text-field>
          <v-img :src="editingItem.logo" class="logo-preview ml-3"></v-img>
        </div>
        <v-text-field v-model="editingItem.homepage" label="Homepage"></v-text-field>
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
import { useSupplierStore } from '@/stores/supplier_store';

const supplierStore = useSupplierStore();
const dialog = ref(false);
const defaultItem: SupplierDoc = { _id: '', name: '' };
const editingIndex = ref(-1);
const editingItem = ref<SupplierDoc>(defaultItem);

const isEditing = computed(() => editingIndex.value > -1);

const cardTitle = computed(() => {
  const prefix = isEditing.value ? 'Edit' : 'Add';
  return prefix + ' Supplier';
});

const actionText = computed(() => {
  return isEditing.value ? 'Update' : 'Save';
});

function create() {
  editingIndex.value = -1;
  editingItem.value = { ...defaultItem };
  dialog.value = true;
}

function edit(i: number) {
  editingIndex.value = i;
  editingItem.value = { ...supplierStore.sorted[editingIndex.value] };
  dialog.value = true;
}

async function close() {
  dialog.value = false;
}

const names = computed(() => {
  return supplierStore.suppliers.map((x) => x.name.toLowerCase());
});

const rules: Rules = {
  required: (value) => !!value || 'Required',
  counter: (value) => value.length <= 20 || 'Max 20 characters',
  unique: (value) =>
    isEditing.value || !names.value.includes(value.toLowerCase()) || 'Name already used',
};

async function save() {
  if (editingIndex.value === -1) {
    await supplierStore.add(editingItem.value);
  } else {
    await supplierStore.update(editingItem.value);
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

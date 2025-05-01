<template>
  <div class="container">
    <SettingsTiles :items="customerStore.customers" @create="create" @edit="edit" />
  </div>
  <v-dialog v-model="dialog" class="dialog">
    <v-card>
      <v-card-title>{{ cardTitle }}</v-card-title>
      <v-card-text>
        <v-form v-model="valid">
          <v-text-field
            v-model="editingItem.name"
            label="Name"
            :rules="[rules.required, rules.counter, rules.unique]"
          />
          <div class="logo-container">
            <v-text-field v-model="editingItem.logo" label="Logo URL" />
            <div class="logo-preview ml-3 elevation-1">
              <img :src="editingItem.logo" alt="" />
            </div>
          </div>
          <v-text-field
            v-model="editingItem.homepage"
            label="Homepage"
            append-inner-icon="mdi-open-in-new"
            @click:append-inner="open"
          />
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn color="green" variant="elevated" :disabled="!valid" @click="save">
          {{ actionText }}
        </v-btn>
        <v-btn color="red" variant="elevated" @click="close">Cancel</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import SettingsTiles from '@/components/settings/SettingsTiles.vue';
import { useCustomerStore } from '@/stores/customer_store';

const customerStore = useCustomerStore();
const dialog = ref(false);
const editingIndex = ref(-1);
const editingItem = ref<CustomerDoc>({} as CustomerDoc);
const valid = ref(true);

const isEditing = computed(() => editingIndex.value > -1);

const cardTitle = computed(() => {
  const prefix = isEditing.value ? 'Edit' : 'Add';
  return prefix + ' Customer';
});

const actionText = computed(() => {
  return isEditing.value ? 'Update' : 'Save';
});

function create() {
  editingIndex.value = -1;
  editingItem.value = {} as CustomerDoc;
  dialog.value = true;
}

function edit(i: number) {
  editingIndex.value = i;
  editingItem.value = { ...customerStore.customers[editingIndex.value] };
  dialog.value = true;
}

async function close() {
  dialog.value = false;
}

const names = computed(() => {
  return customerStore.customers.map((x) => x.name.toLowerCase());
});

const rules: Rules = {
  required: (value) => !!value || 'Required',
  counter: (value) => value.length <= 20 || 'Max 20 characters',
  unique: (value) =>
    isEditing.value || !names.value.includes(value.toLowerCase()) || 'Name already used',
};

async function save() {
  if (editingIndex.value === -1) {
    await customerStore.add(editingItem.value);
  } else {
    await customerStore.update(editingItem.value);
  }
  dialog.value = false;
}

function open() {
  window.open(editingItem.value.homepage, '_blank');
}
</script>

<style scoped>
.container {
  display: flex;
  flex-wrap: wrap;
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
  width: 80px;
  border: 1px solid #ababab;
  border-radius: 10px;
  position: relative;
  bottom: 10px;
  padding: 5px;
  display: flex;
  align-items: center;
}
.logo-preview img {
  width: 100%;
}
</style>

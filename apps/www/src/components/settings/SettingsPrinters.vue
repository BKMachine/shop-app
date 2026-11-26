<template>
  <div class="printer-settings">
    <p class="printer-settings__copy">
      Network printers phones can print photos to, from the Android app and the photo page. Jobs go
      straight to <code>ipp://&lt;hostname&gt;/ipp/print</code>, so the printer must be reachable
      from the server.
    </p>

    <div class="container">
      <SettingsTiles :items="printers" @create="create" @edit="edit">
        <template #badge="{ item }">
          <v-icon
            :color="isShownOnPhones(item._id) ? 'green' : 'grey'"
            :icon="isShownOnPhones(item._id) ? 'mdi-cellphone' : 'mdi-cellphone-off'"
            size="22"
            :title="isShownOnPhones(item._id) ? 'Shown on phones' : 'Hidden from phones'"
          />
        </template>
      </SettingsTiles>
    </div>
  </div>

  <v-dialog v-model="dialog" max-width="420">
    <v-card>
      <v-card-title>{{ cardTitle }}</v-card-title>
      <v-card-text>
        <v-form v-model="valid">
          <v-text-field
            v-model="editingItem.name"
            label="Display Name"
            :rules="[rules.required, rules.nameLength, rules.uniqueName]"
          />
          <v-text-field
            v-model="editingItem.hostname"
            hint="e.g. sharp.bkmachine.lan"
            label="Hostname"
            persistent-hint
            :rules="[rules.required, rules.hostname, rules.uniqueHostname]"
          />
          <v-switch
            v-model="editingItem.showInAndroid"
            class="mt-4"
            color="primary"
            hide-details
            label="Show on phones (Android app and photo page)"
          />
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn color="green" :disabled="!valid" variant="elevated" @click="save">
          {{ actionText }}
        </v-btn>
        <v-btn color="red" variant="elevated" @click="close">Cancel</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import SettingsTiles from '@/components/settings/SettingsTiles.vue';
import api from '@/plugins/axios';
import { toastError, toastSuccess } from '@/plugins/vue-toast-notification';

type PrinterForm = {
  _id?: string;
  __v?: number;
  name: string;
  hostname: string;
  showInAndroid: boolean;
};

const hostnamePattern =
  /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/;

const printers = ref<Printer[]>([]);
const dialog = ref(false);
const editingIndex = ref(-1);
const editingItem = ref<PrinterForm>(createEmptyPrinter());
const valid = ref(true);

const isEditing = computed(() => editingIndex.value > -1);
const cardTitle = computed(() => `${isEditing.value ? 'Edit' : 'Add'} Printer`);
const actionText = computed(() => (isEditing.value ? 'Update' : 'Save'));

// Tiles show a green phone icon, or a grey crossed-out one when phones won't offer the printer.
// (The field is still named showInAndroid; it now covers the photo page too.)
function isShownOnPhones(id: string) {
  return printers.value.find((printer) => printer._id === id)?.showInAndroid ?? false;
}

const rules = {
  required: (value: string) => Boolean(value?.trim()) || 'Required',
  nameLength: (value: string) => value.trim().length <= 40 || 'Max 40 characters',
  hostname: (value: string) =>
    hostnamePattern.test(value.trim().toLowerCase()) || 'Enter a hostname like sharp.bkmachine.lan',
  uniqueName: (value: string) => isUnique('name', value) || 'Name already used',
  uniqueHostname: (value: string) => isUnique('hostname', value) || 'Hostname already used',
} satisfies Rules;

function isUnique(field: 'name' | 'hostname', value: string) {
  const normalizedValue = value.trim().toLowerCase();
  if (!normalizedValue) return true;

  return printers.value.every((printer) => {
    if (printer._id === editingItem.value._id) return true;
    return printer[field].trim().toLowerCase() !== normalizedValue;
  });
}

onMounted(() => {
  void fetchPrinters();
});

async function fetchPrinters() {
  try {
    const { data } = await api.get<Printer[]>('/printers');
    printers.value = sortPrinters(data);
  } catch (error) {
    console.error('Error fetching printers:', error);
    toastError('Unable to load printers.');
  }
}

function create() {
  editingIndex.value = -1;
  editingItem.value = createEmptyPrinter();
  dialog.value = true;
}

function edit(index: number) {
  editingIndex.value = index;
  const printer = printers.value[index];
  if (printer) {
    editingItem.value = {
      _id: printer._id,
      __v: printer.__v,
      name: printer.name,
      hostname: printer.hostname,
      showInAndroid: printer.showInAndroid,
    };
  }
  dialog.value = true;
}

function close() {
  dialog.value = false;
  editingIndex.value = -1;
  editingItem.value = createEmptyPrinter();
}

async function save() {
  const payload = {
    name: editingItem.value.name.trim(),
    hostname: editingItem.value.hostname.trim().toLowerCase(),
    showInAndroid: editingItem.value.showInAndroid,
  };

  try {
    if (editingItem.value._id) {
      const { data } = await api.put<Printer>('/printers', {
        printer: {
          _id: editingItem.value._id,
          __v: editingItem.value.__v,
          ...payload,
        },
      });

      upsertPrinter(data);
      toastSuccess('Printer updated successfully');
    } else {
      const { data } = await api.post<Printer>('/printers', { printer: payload });

      upsertPrinter(data);
      toastSuccess('Printer added successfully');
    }

    close();
  } catch (error) {
    console.error('Error saving printer:', error);
    toastError(editingItem.value._id ? 'Failed to update printer' : 'Failed to add printer');
  }
}

function upsertPrinter(printer: Printer) {
  const index = printers.value.findIndex((item) => item._id === printer._id);
  if (index > -1) {
    printers.value[index] = printer;
  } else {
    printers.value.push(printer);
  }

  printers.value = sortPrinters(printers.value);
}

function sortPrinters(items: Printer[]) {
  return [...items].sort((left, right) => left.name.localeCompare(right.name));
}

function createEmptyPrinter(): PrinterForm {
  return { name: '', hostname: '', showInAndroid: true };
}
</script>

<style scoped>
.printer-settings {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.printer-settings__copy {
  margin: 0;
}

.container {
  display: flex;
  flex-wrap: wrap;
}
</style>

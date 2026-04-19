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
          <div class="logo-section py-2">
            <div class="logo-preview">
              <img
                v-if="editingItem.logo"
                alt=""
                class="logo-preview__img"
                :src="editingItem.logo"
              />
              <MissingImage v-else class="logo-preview__fallback" />
            </div>
            <div class="logo-section__content">
              <div class="text-subtitle-2">Customer Logo</div>
              <div class="text-body-2 text-medium-emphasis">
                {{ editingItem.logo ? 'Manage the current logo image.' : 'Add a single logo image.' }}
              </div>
              <div class="d-flex align-center ga-2 pt-3">
                <v-btn
                  color="primary"
                  :disabled="!editingItem._id"
                  prepend-icon="mdi-image-edit-outline"
                  variant="elevated"
                  @click="imageManagerVisible = true"
                >
                  {{ editingItem.logo ? 'Edit Image' : 'Add Image' }}
                </v-btn>
                <v-btn
                  v-if="editingItem.logo"
                  color="error"
                  :loading="removingImage"
                  prepend-icon="mdi-image-remove-outline"
                  variant="outlined"
                  @click="deleteImageConfirmVisible = true"
                >
                  Remove Image
                </v-btn>
              </div>
              <div v-if="!editingItem._id" class="text-body-2 text-medium-emphasis pt-2">
                Save this customer first, then you can attach a logo.
              </div>
            </div>
          </div>
          <v-text-field
            v-model="editingItem.homepage"
            append-inner-icon="mdi-open-in-new"
            label="Homepage"
            @click:append-inner="open"
          />
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn color="green" :disabled="!valid" variant="elevated" @click="save">
          {{ actionText }}
        </v-btn>
        <v-btn color="red" variant="elevated" @click="close"> Cancel </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
  <ImageManagerDialog
    v-model="imageManagerVisible"
    :entity-id="editingItem._id"
    entity-type="customer"
    :has-image="Boolean(editingItem.logo)"
    :title="editingItem.name"
    @image-selected="onImageSelected"
  />
  <ConfirmDialog
    v-model="deleteImageConfirmVisible"
    confirm-text="Remove"
    :loading="removingImage"
    message="This will remove the current logo from this customer."
    title="Remove Customer Logo?"
    @confirm="removeLogo"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import ImageManagerDialog from '@/components/ImageManagerDialog.vue';
import MissingImage from '@/components/MissingImage.vue';
import SettingsTiles from '@/components/settings/SettingsTiles.vue';
import { useCustomerStore } from '@/stores/customer_store';

const customerStore = useCustomerStore();
const dialog = ref(false);
const editingIndex = ref(-1);
const editingItem = ref<Customer>({} as Customer);
const valid = ref(true);
const imageManagerVisible = ref(false);
const deleteImageConfirmVisible = ref(false);
const removingImage = ref(false);

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
  editingItem.value = {} as Customer;
  dialog.value = true;
}

function edit(i: number) {
  editingIndex.value = i;
  const editingCustomer = customerStore.customers[editingIndex.value];
  if (editingCustomer) editingItem.value = { ...editingCustomer };
  dialog.value = true;
}

async function close() {
  dialog.value = false;
  imageManagerVisible.value = false;
  deleteImageConfirmVisible.value = false;
}

const names = computed(() => {
  return customerStore.customers.map((x) => x.name.toLowerCase());
});

const rules = {
  required: (value) => !!value || 'Required',
  counter: (value) => value.length <= 20 || 'Max 20 characters',
  unique: (value) =>
    isEditing.value || !names.value.includes(value.toLowerCase()) || 'Name already used',
} satisfies Rules;
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

function onImageSelected(payload: { imageId: string; url: string; isMain?: boolean }) {
  editingItem.value.logo = payload.url;
  if (editingItem.value._id) {
    customerStore.updateCustomerLogo(editingItem.value._id, payload.url);
  }
}

async function removeLogo() {
  if (!editingItem.value._id) return;

  removingImage.value = true;
  try {
    const removed = await customerStore.removeCustomerLogo(editingItem.value._id);
    if (removed) {
      editingItem.value.logo = '';
      deleteImageConfirmVisible.value = false;
    }
  } finally {
    removingImage.value = false;
  }
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
.logo-preview {
  height: 80px;
  width: 80px;
  border: 1px solid #ababab;
  border-radius: 10px;
  padding: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.logo-preview__img {
  width: 100%;
}
.logo-preview__fallback {
  width: 100%;
  height: 100%;
  border-radius: 10px;
}
.logo-section {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.logo-section__content {
  flex: 1;
}
</style>

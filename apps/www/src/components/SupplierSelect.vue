<template>
  <v-select
    v-model="selectedSupplierId"
    clearable
    item-title="name"
    item-value="_id"
    :items="supplierStore.suppliers"
    :label="label"
  >
    <template #item="{ props, item }">
      <v-list-item v-bind="props" title="">
        <template #prepend>
          <div class="supplier-logo-frame supplier-logo-frame--menu supplier-logo-frame--with-gap">
            <img
              v-if="hasLogoUrl(item.raw.logo)"
              alt=""
              class="supplier-logo"
              :src="item.raw.logo"
            />
            <v-icon v-else class="supplier-logo-fallback" icon="mdi-image-off-outline" size="16" />
          </div>
        </template>
        {{ item.raw.name }}
      </v-list-item>
    </template>

    <template #selection="{ item }">
      <div class="supplier-selection">
        <div class="supplier-logo-frame supplier-logo-frame--selection">
          <img v-if="hasLogoUrl(item.raw.logo)" alt="" class="supplier-logo" :src="item.raw.logo" />
          <v-icon v-else class="supplier-logo-fallback" icon="mdi-image-off-outline" size="14" />
        </div>
        <span class="supplier-selection__text">{{ item.raw.name }}</span>
      </div>
    </template>
  </v-select>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { hasLogoUrl } from '@/plugins/utils';
import { useSupplierStore } from '@/stores/supplier_store';

const props = withDefaults(
  defineProps<{
    modelValue?: string | Supplier | null;
    label?: string;
  }>(),
  {
    modelValue: null,
    label: 'Supplier',
  },
);

const emit = defineEmits<(e: 'update:modelValue', value: string | null) => void>();

const supplierStore = useSupplierStore();

const selectedSupplierId = computed({
  get: () => {
    if (!props.modelValue) return null;
    return typeof props.modelValue === 'string' ? props.modelValue : props.modelValue._id;
  },
  set: (value: string | null) => {
    emit('update:modelValue', value);
  },
});

onMounted(() => {
  if (!supplierStore.suppliers.length) {
    supplierStore.fetch();
  }
});
</script>

<style scoped>
.supplier-selection {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.supplier-selection__text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.supplier-logo-frame {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  padding: 0;
}

.supplier-logo-frame--menu {
  width: 36px;
  height: 24px;
}

.supplier-logo-frame--selection {
  width: 32px;
  height: 20px;
}

.supplier-logo-frame--with-gap {
  margin-right: 8px;
}

.supplier-logo {
  display: block;
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
}

.supplier-logo-fallback {
  opacity: 0.7;
}
</style>

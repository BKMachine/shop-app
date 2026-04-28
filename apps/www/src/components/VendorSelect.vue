<template>
  <v-select
    v-model="selectedVendorId"
    clearable
    item-title="name"
    item-value="_id"
    :items="vendorStore.vendors"
    :label="label"
  >
    <template #item="{ props, item }">
      <v-list-item v-bind="props" title="">
        <template #prepend>
          <div class="vendor-logo-frame vendor-logo-frame--menu vendor-logo-frame--with-gap">
            <img v-if="hasLogoUrl(item.logo)" alt="" class="vendor-logo" :src="item.logo" />
            <v-icon v-else class="vendor-logo-fallback" icon="mdi-image-off-outline" size="16" />
          </div>
        </template>
        {{ item.name }}
      </v-list-item>
    </template>

    <template #selection="{ item }">
      <div class="vendor-selection">
        <div class="vendor-logo-frame vendor-logo-frame--selection">
          <img v-if="hasLogoUrl(item.logo)" alt="" class="vendor-logo" :src="item.logo" />
          <v-icon v-else class="vendor-logo-fallback" icon="mdi-image-off-outline" size="14" />
        </div>
        <span class="vendor-selection__text">{{ item.name }}</span>
      </div>
    </template>
  </v-select>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { hasLogoUrl } from '@/plugins/utils';
import { useVendorStore } from '@/stores/vendor_store';

const props = withDefaults(
  defineProps<{
    modelValue?: string | Vendor | null;
    label?: string;
  }>(),
  {
    modelValue: null,
    label: 'Brand',
  },
);

const emit = defineEmits<(e: 'update:modelValue', value: string | null) => void>();

const vendorStore = useVendorStore();

const selectedVendorId = computed({
  get: () => {
    if (!props.modelValue) return null;
    return typeof props.modelValue === 'string' ? props.modelValue : props.modelValue._id;
  },
  set: (value: string | null) => {
    emit('update:modelValue', value);
  },
});

onMounted(() => {
  if (!vendorStore.vendors.length) {
    vendorStore.fetch();
  }
});
</script>

<style scoped>
.vendor-selection {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.vendor-selection__text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vendor-logo-frame {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  padding: 0;
}

.vendor-logo-frame--menu {
  width: 36px;
  height: 24px;
}

.vendor-logo-frame--selection {
  width: 32px;
  height: 20px;
}

.vendor-logo-frame--with-gap {
  margin-right: 8px;
}

.vendor-logo {
  display: block;
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
}

.vendor-logo-fallback {
  opacity: 0.7;
}
</style>

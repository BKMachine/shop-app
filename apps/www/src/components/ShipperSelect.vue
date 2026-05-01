<template>
  <v-autocomplete
    v-model="selectedShipperId"
    clearable
    item-title="name"
    item-value="_id"
    :items="shipperStore.shippers"
    :label="label"
  >
    <template #item="{ props, item }">
      <v-list-item v-bind="props" title="">
        <template #prepend>
          <div class="shipper-logo-frame shipper-logo-frame--menu shipper-logo-frame--with-gap">
            <img v-if="hasLogoUrl(item.logo)" alt="" class="shipper-logo" :src="item.logo" />
            <v-icon v-else class="shipper-logo-fallback" icon="mdi-truck-fast-outline" size="16" />
          </div>
        </template>
        {{ item.name }}
      </v-list-item>
    </template>

    <template #selection="{ item }">
      <div class="shipper-selection">
        <div class="shipper-logo-frame shipper-logo-frame--selection">
          <img v-if="hasLogoUrl(item.logo)" alt="" class="shipper-logo" :src="item.logo" />
          <v-icon v-else class="shipper-logo-fallback" icon="mdi-truck-fast-outline" size="14" />
        </div>
        <span class="shipper-selection__text">{{ item.name }}</span>
      </div>
    </template>
  </v-autocomplete>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { hasLogoUrl } from '@/plugins/utils';
import { useShipperStore } from '@/stores/shipper_store';

const props = withDefaults(
  defineProps<{
    modelValue?: string | Shipper | null;
    label?: string;
  }>(),
  {
    modelValue: null,
    label: 'Shipper',
  },
);

const emit = defineEmits<(e: 'update:modelValue', value: string | null) => void>();

const shipperStore = useShipperStore();

const selectedShipperId = computed({
  get: () => {
    if (!props.modelValue) return null;
    return typeof props.modelValue === 'string' ? props.modelValue : props.modelValue._id;
  },
  set: (value: string | null) => {
    emit('update:modelValue', value);
  },
});

onMounted(() => {
  if (!shipperStore.shippers.length) {
    shipperStore.fetch();
  }
});
</script>

<style scoped>
.shipper-selection {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.shipper-selection__text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shipper-logo-frame {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  padding: 0;
}

.shipper-logo-frame--menu {
  width: 36px;
  height: 24px;
}

.shipper-logo-frame--selection {
  width: 32px;
  height: 20px;
}

.shipper-logo-frame--with-gap {
  margin-right: 8px;
}

.shipper-logo {
  display: block;
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
}

.shipper-logo-fallback {
  opacity: 0.7;
}
</style>

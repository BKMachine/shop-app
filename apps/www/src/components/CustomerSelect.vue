<template>
  <v-select
    v-model="selectedCustomerId"
    clearable
    item-title="name"
    item-value="_id"
    :items="customerStore.customers"
    :label="label"
  >
    <template #item="{ props, item }">
      <v-list-item v-bind="props" title="">
        <template #prepend>
          <div class="customer-logo-frame customer-logo-frame--menu customer-logo-frame--with-gap">
            <img
              v-if="hasLogoUrl(item.raw.logo)"
              alt=""
              class="customer-logo"
              :src="item.raw.logo"
            />
            <v-icon v-else class="customer-logo-fallback" icon="mdi-image-off-outline" size="16" />
          </div>
        </template>
        {{ item.raw.name }}
      </v-list-item>
    </template>

    <template #selection="{ item }">
      <div class="customer-selection">
        <div class="customer-logo-frame customer-logo-frame--selection">
          <img v-if="hasLogoUrl(item.raw.logo)" alt="" class="customer-logo" :src="item.raw.logo" />
          <v-icon v-else class="customer-logo-fallback" icon="mdi-image-off-outline" size="14" />
        </div>
        <span class="customer-selection__text">{{ item.raw.name }}</span>
      </div>
    </template>
  </v-select>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { hasLogoUrl } from '@/plugins/utils';
import { useCustomerStore } from '@/stores/customer_store';

const props = withDefaults(
  defineProps<{
    modelValue?: string | Customer | null;
    label?: string;
  }>(),
  {
    modelValue: null,
    label: 'Customer',
  },
);

const emit = defineEmits<(e: 'update:modelValue', value: string | null) => void>();

const customerStore = useCustomerStore();

const selectedCustomerId = computed({
  get: () => {
    if (!props.modelValue) return null;
    return typeof props.modelValue === 'string' ? props.modelValue : props.modelValue._id;
  },
  set: (value: string | null) => {
    emit('update:modelValue', value);
  },
});

onMounted(() => {
  if (!customerStore.customers.length) {
    customerStore.fetch();
  }
});
</script>

<style scoped>
.customer-selection {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.customer-selection__text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.customer-logo-frame {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  padding: 0;
}

.customer-logo-frame--menu {
  width: 36px;
  height: 24px;
}

.customer-logo-frame--selection {
  width: 32px;
  height: 20px;
}

.customer-logo-frame--with-gap {
  margin-right: 8px;
}

.customer-logo {
  display: block;
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
}

.customer-logo-fallback {
  opacity: 0.7;
}
</style>

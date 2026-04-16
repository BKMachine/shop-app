<template>
  <div ref="tableHost" class="infinite-table-host">
    <v-data-table-virtual
      :custom-key-sort="customKeySort"
      fixed-header
      :headers="headers"
      :height="tableHeight"
      :items="items"
      :loading="loading"
      :sort-by="sortBy"
      @click:row="handleClickRow"
      @update:sort-by="handleUpdateSortBy"
    >
      <template v-for="slotName in forwardedSlotNames" :key="slotName" #[slotName]="slotProps">
        <slot :name="slotName" v-bind="slotProps" />
      </template>

      <template #bottom>
        <div v-if="showTableStatus" class="infinite-table-status">
          <v-progress-linear
            v-if="loadingMore"
            class="infinite-table-progress"
            color="primary"
            indeterminate
            rounded
          />
          <span v-else-if="showAllItemsLoaded">All items loaded.</span>
        </div>
      </template>
    </v-data-table-virtual>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, useSlots, watch } from 'vue';
import { useVirtualTableScroll } from '@/lib/useVirtualTableScroll';

type TableSort = { key: string; order: 'asc' | 'desc' };
type CustomKeySort = Record<string, (...args: unknown[]) => number>;

const props = withDefaults(
  defineProps<{
    headers: readonly Record<string, unknown>[];
    items: readonly unknown[];
    loading: boolean;
    hasMore: boolean;
    loadingMore: boolean;
    sortBy?: TableSort[];
    customKeySort?: CustomKeySort;
    minHeight?: number;
    bottomPadding?: number;
  }>(),
  {
    sortBy: () => [],
    customKeySort: () => ({}),
    minHeight: 320,
    bottomPadding: 32,
  },
);

const emit = defineEmits(['click:row', 'update:sortBy', 'loadMore']);

const slots = useSlots();
const tableHost = ref<HTMLElement | null>(null);
const { bindScrollElement, isAtTableBottom, isTableScrollable, tableHeight, updateTableHeight } =
  useVirtualTableScroll({
    tableHost,
    canLoadMore: () => !props.loading && !props.loadingMore && props.hasMore,
    onLoadMore: () => emit('loadMore'),
    minHeight: props.minHeight,
    bottomPadding: props.bottomPadding,
  });

const forwardedSlotNames = computed(() => {
  return Object.keys(slots).filter((name) => name !== 'default' && name !== 'bottom');
});

const showAllItemsLoaded = computed(() => {
  return (
    !props.hasMore && props.items.length > 0 && (!isTableScrollable.value || isAtTableBottom.value)
  );
});

const showTableStatus = computed(() => {
  return props.loadingMore || showAllItemsLoaded.value;
});

function handleClickRow(event: unknown, payload: unknown) {
  emit('click:row', event, payload);
}

function handleUpdateSortBy(value: TableSort[]) {
  emit('update:sortBy', value);
}

async function refreshLayout() {
  await nextTick();
  updateTableHeight();
  await bindScrollElement();
}

watch(
  () => props.items,
  async () => {
    await bindScrollElement();
  },
  { immediate: true },
);

watch(
  () => props.items.length,
  async () => {
    await refreshLayout();
  },
);

watch(
  () => props.hasMore,
  () => {
    void bindScrollElement();
  },
);

defineExpose({
  refreshLayout,
});
</script>

<style scoped>
.infinite-table-host {
  position: relative;
  overflow: hidden;
}

.infinite-table-status {
  min-height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  color: rgba(0, 0, 0, 0.6);
}

.infinite-table-progress {
  width: 100%;
}
</style>

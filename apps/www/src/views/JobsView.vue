<template>
  <v-card class="jobs-view-card">
    <v-card-title class="header mt-4">
      <div class="d-flex flex-column">
        <span>Jobs</span>
        <div class="text-title-small text-medium-emphasis">{{ jobsCountLabel }}</div>
      </div>
      <div class="header-actions">
        <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreateDialog">
          Create Job
        </v-btn>
      </div>
    </v-card-title>

    <v-card-text class="jobs-view-card__body">
      <v-row>
        <v-col cols="6">
          <v-text-field
            v-model="filters.search"
            clearable
            label="Search"
            prepend-inner-icon="mdi-magnify"
            single-line
            variant="outlined"
            @click:clear="clearSearchFilter"
          >
            <template #details>
              <div class="search-details">
                <button class="clear-filters-hint" type="button" @click="clearFilters">
                  Clear all filters
                </button>
              </div>
            </template>
          </v-text-field>
        </v-col>
        <v-col cols="4">
          <CustomerSelect v-model="filters.customer" clearable hide-details label="Customer" />
        </v-col>
        <v-col cols="2">
          <v-select
            v-model="filters.status"
            hide-details
            item-title="title"
            item-value="value"
            :items="statusFilterOptions"
            label="Status"
            variant="outlined"
          />
        </v-col>
      </v-row>

      <InfiniteScrollDataTable
        ref="tableRef"
        :has-more="jobsStore.hasMore"
        :headers="headers"
        :items="jobsStore.jobs"
        :loading="jobsStore.loading"
        :loading-more="jobsStore.loading && jobsStore.jobs.length > 0"
        :sort-by="sortBy"
        @click:row="openDetails"
        @load-more="loadMore"
        @update:sort-by="updateSortBy"
      >
        <template #['item.jobNumber']="{ item }">
          <span class="job-number">#{{ item.jobNumber }}</span>
        </template>

        <template #['item.img']="{ item }">
          <v-hover>
            <template #default="{ props }">
              <v-img
                v-if="hasPartImage(item)"
                v-bind="props"
                :id="item._id"
                class="part-img"
                contain
                :src="displayPartImageSrc(item)"
                @error="markImageMissing(item._id)"
                @mouseenter="showExpandedImage(item, $event)"
                @mouseleave="hideExpandedImage"
              />
              <MissingImage v-else class="part-img part-img-fallback" />
            </template>
          </v-hover>
        </template>

        <template #['item.customerName']="{ item }"> {{ displayCustomerName(item) }} </template>

        <template #['item.partNumber']="{ item }">
          <div class="part-cell">
            <span class="part-cell__number">{{ displayPartNumber(item) }}</span>
            <span class="part-cell__description">{{ displayPartDescription(item) }}</span>
          </div>
        </template>

        <template #['item.material']="{ item }">
          <MaterialSwatch :on-hand="item.materialOnHandOn" :ordered="item.materialOrderedOn" />
        </template>

        <template #['item.status']="{ item }">
          <v-chip :color="statusColor(item.status)" size="small">
            {{ statusLabel(item.status) }}
          </v-chip>
        </template>

        <template #['item.priority']="{ item }">
          <v-chip :color="priorityColor(item.priority)" size="small" variant="tonal">
            {{ item.priority || 'normal' }}
          </v-chip>
        </template>

        <template #['item.dueDate']="{ item }">
          <v-chip
            v-if="item.dueDate"
            :color="dueDateColor(item.dueDate)"
            size="small"
            variant="tonal"
          >
            {{ formatRelativeDate(item.dueDate) }}
          </v-chip>
        </template>
      </InfiniteScrollDataTable>
    </v-card-text>
  </v-card>

  <teleport to="body">
    <div
      v-if="expandedImage.visible"
      class="expanded-img-container"
      :style="{ top: expandedImage.top + 'px', left: expandedImage.left + 'px' }"
    >
      <v-img class="expanded-img" :src="expandedImage.src" />
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { type LocationQueryValue, useRoute } from 'vue-router';
import CustomerSelect from '@/components/CustomerSelect.vue';
import InfiniteScrollDataTable from '@/components/InfiniteScrollDataTable.vue';
import MaterialSwatch from '@/components/jobs/MaterialSwatch.vue';
import MissingImage from '@/components/MissingImage.vue';
import { dueDateColor, formatRelativeDate } from '@/lib/job_dates';
import router from '@/router';
import { useJobsStore } from '@/stores/jobs_store';

type FilterStatus = 'all' | 'closed' | 'in_process' | 'not_closed';

type JobFilterQueryKey = 'search' | 'customer' | 'status';

const FILTER_QUERY_KEYS: JobFilterQueryKey[] = ['search', 'customer', 'status'];

const route = useRoute();
const jobsStore = useJobsStore();
const tableRef = ref<InstanceType<typeof InfiniteScrollDataTable> | null>(null);
const sortBy = ref<Array<{ key: string; order: 'asc' | 'desc' }>>([]);
const missingImageIds = ref<Record<string, boolean>>({});
const expandedImage = ref({
  visible: false,
  partId: '',
  src: '',
  top: 0,
  left: 0,
});
let searchDebounceId: ReturnType<typeof setTimeout> | null = null;

const filters = reactive<{
  search: string;
  customer: string | null;
  status: FilterStatus;
}>({
  search: '',
  customer: null,
  status: 'not_closed',
});

const headers = [
  { title: 'Job #', key: 'jobNumber', width: 110 },
  { title: '', key: 'img', width: 72, sortable: false },
  { title: 'Part', key: 'partNumber' },
  { title: 'Customer', key: 'customerName' },
  { title: 'Qty', key: 'qty', width: 90 },
  { title: 'Material', key: 'material', width: 110, sortable: false, align: 'center' },
  { title: 'Status', key: 'status', width: 110, align: 'center' },
  { title: 'Priority', key: 'priority', width: 110, align: 'center' },
  { title: 'Due', key: 'dueDate', width: 130, format: formatRelativeDate, align: 'center' },
  { title: 'Completed', key: 'completedOn', width: 130, format: formatRelativeDate },
  { title: 'PO', key: 'customerPo' },
];

const statusFilterOptions = [
  { title: 'All', value: 'all' },
  { title: 'Closed', value: 'closed' },
  { title: 'In Process', value: 'in_process' },
  { title: 'Not Closed', value: 'not_closed' },
];

const jobsCountLabel = computed(() => {
  const count = jobsStore.total;
  if (count === 1) return '1 job';
  return `${count} jobs`;
});

watch(
  () => route.query,
  () => {
    applyRouteFilters();
    void applyFilters();
  },
  { immediate: true },
);

watch(
  () => filters.customer,
  () => {
    syncFiltersToQuery();
  },
);

watch(
  () => filters.status,
  () => {
    syncFiltersToQuery();
  },
);

watch(
  () => filters.search,
  () => {
    if (searchDebounceId) {
      clearTimeout(searchDebounceId);
    }

    searchDebounceId = setTimeout(() => {
      syncFiltersToQuery();
    }, 250);
  },
);

onMounted(async () => {
  await nextTick();
  await tableRef.value?.refreshLayout?.();
});

function applyRouteFilters() {
  filters.search = firstQueryValue(route.query.search) ?? '';
  filters.customer = firstQueryValue(route.query.customer) ?? null;

  const routeStatus = firstQueryValue(route.query.status);
  filters.status =
    routeStatus === 'all' ||
    routeStatus === 'closed' ||
    routeStatus === 'in_process' ||
    routeStatus === 'not_closed'
      ? routeStatus
      : routeStatus === 'open'
        ? 'not_closed'
        : 'not_closed';
}

function syncFiltersToQuery() {
  const nextQuery = buildFilterQuery();

  if (areFilterQueriesEqual(route.query, nextQuery)) {
    return;
  }

  router.replace({ query: nextQuery });
}

async function applyFilters() {
  await jobsStore.fetch({
    search: filters.search.trim() || undefined,
    customer: filters.customer || undefined,
    status: filters.status === 'all' ? undefined : filters.status,
  });
}

async function clearFilters() {
  filters.search = '';
  filters.customer = null;
  filters.status = 'not_closed';
  syncFiltersToQuery();
}

function clearSearchFilter() {
  filters.search = '';
  syncFiltersToQuery();
}

function buildFilterQuery() {
  const baseQuery = Object.fromEntries(
    Object.entries(route.query).filter(
      ([key]) => !FILTER_QUERY_KEYS.includes(key as JobFilterQueryKey),
    ),
  );

  return {
    ...baseQuery,
    ...(filters.search.trim() ? { search: filters.search.trim() } : {}),
    ...(filters.customer ? { customer: filters.customer } : {}),
    ...(filters.status !== 'not_closed' ? { status: filters.status } : {}),
  };
}

function firstQueryValue(value: LocationQueryValue | LocationQueryValue[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? undefined;
  return typeof value === 'string' ? value : undefined;
}

function areFilterQueriesEqual(
  currentQuery: Record<string, unknown>,
  nextQuery: Record<string, string | undefined>,
) {
  const currentEntries = Object.entries(currentQuery)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => [key, Array.isArray(value) ? value.join(',') : String(value)]);
  const nextEntries = Object.entries(nextQuery)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => [key, String(value)]);

  if (currentEntries.length !== nextEntries.length) return false;

  return currentEntries.every(([key, value]) => {
    return nextEntries.some(([nextKey, nextValue]) => nextKey === key && nextValue === value);
  });
}

async function loadMore() {
  await jobsStore.fetchNextPage();
}

function updateSortBy(value: Array<{ key: string; order: 'asc' | 'desc' }>) {
  sortBy.value = value;
}

function openCreateDialog() {
  router.push({ name: 'createJob' });
}

function openDetails(_event: unknown, { item }: { item: Job }) {
  router.push({ name: 'viewJob', params: { id: item._id } });
}

function displayCustomerName(job: Job) {
  return job.customerName || (typeof job.customer === 'string' ? '' : job.customer?.name || '');
}

function displayPartNumber(job: Job) {
  return job.partNumber || (typeof job.part === 'string' ? '' : job.part?.part || '');
}

function displayPartDescription(job: Job) {
  return job.partDescription || (typeof job.part === 'string' ? '' : job.part?.description || '');
}

function displayPartImageSrc(job: Job) {
  return typeof job.part === 'string' ? '' : job.part?.img?.trim() || '';
}

function hasPartImage(job: Job) {
  return Boolean(displayPartImageSrc(job)) && !missingImageIds.value[job._id];
}

function markImageMissing(jobId: string) {
  missingImageIds.value = {
    ...missingImageIds.value,
    [jobId]: true,
  };

  if (expandedImage.value.visible && expandedImage.value.partId === jobId) {
    hideExpandedImage();
  }
}

function showExpandedImage(job: Job, event: MouseEvent) {
  const src = displayPartImageSrc(job);
  if (!src || !hasPartImage(job)) return;

  const target = event.target as HTMLElement;
  const rect = target.getBoundingClientRect();
  expandedImage.value = {
    visible: true,
    partId: job._id,
    src,
    top: rect.top,
    left: rect.right,
  };
}

function hideExpandedImage() {
  expandedImage.value = {
    visible: false,
    partId: '',
    src: '',
    top: 0,
    left: 0,
  };
}

function priorityColor(priority: JobPriority | undefined) {
  if (priority === 'rush') return 'error';
  if (priority === 'low') return 'grey';
  return 'primary';
}

function statusColor(status: JobStatus) {
  if (status === 'closed') return 'grey';
  if (status === 'in_process') return 'warning';
  return 'success';
}

function statusLabel(status: JobStatus) {
  if (status === 'in_process') return 'In Process';
  if (status === 'closed') return 'Closed';
  return 'Open';
}
</script>

<style scoped>
.jobs-view-card,
.jobs-view-card__body {
  height: calc(100vh - 88px);
}

.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-details {
  display: flex;
  justify-content: flex-start;
}

.clear-filters-hint {
  border: 0;
  padding: 0;
  background: none;
  color: rgb(var(--v-theme-primary));
  cursor: pointer;
  font: inherit;
}

.job-number {
  font-weight: 700;
}

.part-img {
  width: 38px;
  height: 38px;
  margin: 2px auto;
  cursor: zoom-in;
}

.part-img-fallback {
  width: 38px;
  min-height: 38px;
  margin: 2px auto;
}

.expanded-img-container {
  position: absolute;
  z-index: 10;
  pointer-events: none;
}

.expanded-img {
  width: 360px;
  max-height: 360px;
  border: 1px solid #ccc;
  background: white;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.part-cell {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.part-cell__number {
  font-weight: 600;
}

.part-cell__description {
  font-size: 0.85rem;
  color: rgba(0, 0, 0, 0.6);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

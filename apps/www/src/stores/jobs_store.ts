import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import api from '@/plugins/axios';
import { socket } from '@/plugins/socket';
import { toastError, toastSuccess } from '@/plugins/vue-toast-notification';

function getRelatedEntityId(value: string | { _id: string } | undefined | null) {
  if (!value) return undefined;
  return typeof value === 'string' ? value : value._id;
}

function normalizeDateValue(value: string | Date | null | undefined) {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  const trimmedValue = value.trim();
  return trimmedValue || undefined;
}

function toJobCreatePayload(job: Job | JobCreate): JobCreate {
  return {
    customer: getRelatedEntityId(job.customer) ?? '',
    part: getRelatedEntityId(job.part) ?? '',
    qty: Math.max(1, Number(job.qty) || 1),
    status: job.status,
    dueDate: normalizeDateValue(job.dueDate),
    startedOn: normalizeDateValue(job.startedOn),
    completedOn: job.status === 'closed' ? normalizeDateValue(job.completedOn) : undefined,
    customerPo: job.customerPo?.trim() || undefined,
    priority: job.priority || 'normal',
    notes: job.notes?.trim() || undefined,
  };
}

function toJobUpdatePayload(job: Job | JobUpdate): JobUpdate {
  return {
    ...toJobCreatePayload(job),
    _id: job._id,
    jobNumber: job.jobNumber,
    __v: '__v' in job ? job.__v : undefined,
  };
}

function normalizeQuery(query: JobListQuery): JobListQuery {
  return Object.fromEntries(
    Object.entries(query).filter(
      ([, value]) => value !== '' && value !== undefined && value !== null,
    ),
  ) as JobListQuery;
}

export const useJobsStore = defineStore('jobs', () => {
  const _jobs = ref<Job[]>([]);
  const total = ref(0);
  const loading = ref(false);
  const limit = ref(50);
  const offset = ref(0);
  const hasMore = ref(false);
  const currentQuery = ref<JobListQuery>({});

  const jobs = computed(() => [..._jobs.value]);

  async function fetch(query: JobListQuery = {}, append = false) {
    const nextQuery = normalizeQuery(query);
    const nextLimit = Math.min(Math.max(Number(nextQuery.limit) || limit.value, 1), 200);
    const nextOffset = append ? _jobs.value.length : Math.max(Number(nextQuery.offset) || 0, 0);
    const requestQuery = {
      ...nextQuery,
      limit: nextLimit,
      offset: nextOffset,
    };

    currentQuery.value = requestQuery;
    loading.value = true;

    try {
      const { data } = await api.get<JobListResponse>('/jobs', {
        params: requestQuery,
      });

      if (append) {
        const existingIds = new Set(_jobs.value.map((job) => job._id));
        _jobs.value = [..._jobs.value, ...data.items.filter((job) => !existingIds.has(job._id))];
      } else {
        _jobs.value = data.items;
      }

      total.value = data.total;
      limit.value = data.limit;
      offset.value = data.offset;
      hasMore.value = data.hasMore;
    } catch (error) {
      toastError('Failed to load jobs');
      throw error;
    } finally {
      loading.value = false;
    }
  }

  async function refresh() {
    await fetch(currentQuery.value);
  }

  async function fetchNextPage() {
    if (loading.value || !hasMore.value) return;
    await fetch(currentQuery.value, true);
  }

  async function findById(jobId: string) {
    try {
      const { data } = await api.get<Job>(`/jobs/${jobId}`);
      upsertJob(data);
      return data;
    } catch (error) {
      toastError('Failed to load job');
      throw error;
    }
  }

  async function create(job: Job | JobCreate) {
    try {
      const { data } = await api.post<Job>('/jobs', { job: toJobCreatePayload(job) });
      await refresh();
      toastSuccess('Job created');
      return data;
    } catch (error) {
      toastError('Failed to create job');
      throw error;
    }
  }

  async function update(job: Job | JobUpdate) {
    try {
      const { data } = await api.put<Job>('/jobs', { job: toJobUpdatePayload(job) });
      await refresh();
      toastSuccess('Job updated');
      return data;
    } catch (error) {
      toastError('Failed to update job');
      throw error;
    }
  }

  async function remove(jobId: string) {
    try {
      await api.delete(`/jobs/${jobId}`);
      removeLocalJob(jobId);
      toastSuccess('Job removed');
    } catch (error) {
      toastError('Failed to remove job');
      throw error;
    }
  }

  function removeLocalJob(jobId: string) {
    const nextJobs = _jobs.value.filter((job) => job._id !== jobId);
    if (nextJobs.length === _jobs.value.length) return;

    _jobs.value = nextJobs;
    total.value = Math.max(total.value - 1, 0);
  }

  function upsertJob(job: Job) {
    const index = _jobs.value.findIndex((candidate) => candidate._id === job._id);
    if (index > -1) {
      _jobs.value[index] = job;
      return;
    }

    _jobs.value.unshift(job);
    total.value += 1;
  }

  socket.on('job', (job: Job) => {
    upsertJob(job);
  });

  socket.on('jobDeleted', (data: { id: string }) => {
    removeLocalJob(data.id);
  });

  return {
    jobs,
    total,
    loading,
    limit,
    offset,
    hasMore,
    fetch,
    refresh,
    fetchNextPage,
    findById,
    create,
    update,
    remove,
  };
});

import { computed, ref } from 'vue';

export const JOB_SCAN_DESTINATIONS = ['general', 'production'] as const;

export type JobScanDestination = (typeof JOB_SCAN_DESTINATIONS)[number];

const JOB_SCAN_DESTINATION_STORAGE_KEY = 'shop-app-job-scan-destination';
const jobScanDestination = ref<JobScanDestination>('production');

function isJobScanDestination(value: unknown): value is JobScanDestination {
  return typeof value === 'string' && JOB_SCAN_DESTINATIONS.includes(value as JobScanDestination);
}

function readStoredJobScanDestination(): JobScanDestination {
  if (typeof window === 'undefined') return 'production';

  const storedValue = window.localStorage.getItem(JOB_SCAN_DESTINATION_STORAGE_KEY);
  return isJobScanDestination(storedValue) ? storedValue : 'production';
}

function writeStoredJobScanDestination(value: JobScanDestination) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(JOB_SCAN_DESTINATION_STORAGE_KEY, value);
}

jobScanDestination.value = readStoredJobScanDestination();

export const useJobScanDestination = computed({
  get: () => {
    jobScanDestination.value = readStoredJobScanDestination();
    return jobScanDestination.value;
  },
  set: (value: JobScanDestination) => {
    jobScanDestination.value = value;
    writeStoredJobScanDestination(value);
  },
});

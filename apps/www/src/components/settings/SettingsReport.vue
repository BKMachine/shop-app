<template>
  <v-card class="report-settings" rounded="lg">
    <div class="report-settings__hero">
      <div>
        <div class="report-settings__eyebrow">Automated delivery</div>
        <h3 class="report-settings__title">Email Report Recipients</h3>
      </div>

      <div class="report-settings__chips">
        <v-chip prepend-icon="mdi-email-multiple-outline" variant="flat">
          {{ recipientCount }}
          recipients
        </v-chip>
        <v-chip color="primary" prepend-icon="mdi-send-outline" variant="tonal">
          {{ toCount }}
          to
        </v-chip>
        <v-chip color="secondary" prepend-icon="mdi-email-outline" variant="tonal">
          {{ ccCount }}
          cc
        </v-chip>
      </div>
    </div>

    <v-card class="report-settings__composer" rounded="lg" variant="outlined">
      <v-card-text>
        <div class="report-settings__composer-header">
          <div>
            <div class="report-settings__composer-title">Add recipient</div>
            <div class="report-settings__composer-copy">
              Each email address is stored once and can be assigned per report type.
            </div>
          </div>

          <v-btn
            color="primary"
            :disabled="!draftEmail.trim()"
            :loading="addPending"
            prepend-icon="mdi-plus"
            @click="addEmail"
          >
            Add Email
          </v-btn>
        </div>

        <v-text-field
          v-model="draftEmail"
          class="mt-4"
          clearable
          density="comfortable"
          label="Recipient email"
          prepend-inner-icon="mdi-at"
          variant="solo-filled"
          @keydown.enter.prevent="addEmail"
        />
      </v-card-text>
    </v-card>

    <v-card class="mt-4" rounded="lg" variant="outlined">
      <v-progress-linear v-if="loading" color="primary" indeterminate />

      <template v-if="emails.length">
        <v-table class="report-settings__table" density="comfortable">
          <thead>
            <tr>
              <th class="report-settings__recipient-header" rowspan="2">Recipient</th>
              <th class="report-settings__group-header text-center">Tooling Report</th>
              <th class="report-settings__actions-header text-right" rowspan="2">Actions</th>
            </tr>
            <tr>
              <th class="report-settings__group-subheader text-center">To/Cc</th>
            </tr>
          </thead>

          <tbody>
            <tr v-for="email in emails" :key="email._id" class="report-settings__row">
              <td class="report-settings__recipient-cell">
                <v-text-field
                  v-model="email.email"
                  class="report-settings__email-input"
                  density="comfortable"
                  hide-details
                  label="Email"
                  prepend-inner-icon="mdi-email-outline"
                  variant="solo-filled"
                  @blur="saveEmail(email)"
                  @keydown.enter.prevent="saveEmail(email)"
                />
              </td>
              <td class="report-settings__report-cell text-center">
                <div
                  aria-label="Tooling report recipients"
                  class="report-settings__report-toggle-group"
                  role="group"
                >
                  <v-checkbox
                    class="report-settings__checkbox"
                    color="primary"
                    density="compact"
                    hide-details
                    :model-value="email.tooling.to"
                    @update:model-value="updateToolingTo(email, Boolean($event))"
                  />

                  <v-checkbox
                    class="report-settings__checkbox"
                    color="secondary"
                    density="compact"
                    hide-details
                    :model-value="email.tooling.cc"
                    @update:model-value="updateToolingCc(email, Boolean($event))"
                  />
                </div>
              </td>
              <td class="report-settings__actions-cell text-right">
                <v-btn
                  color="error"
                  icon="mdi-delete-outline"
                  variant="text"
                  @click="confirmDeleteEmail(email)"
                />
              </td>
            </tr>
          </tbody>
        </v-table>
      </template>

      <v-card-text v-else class="report-settings__empty">
        <v-icon color="medium-emphasis" icon="mdi-email-lock-outline" size="42" />
        <div class="report-settings__empty-title">No recipients configured yet</div>
        <p class="report-settings__empty-copy">
          Add the first address above, then choose whether it should receive tooling reorder emails
          as a direct recipient or carbon copy.
        </p>
      </v-card-text>
    </v-card>

    <ConfirmDialog
      v-model="deleteConfirmVisible"
      confirm-text="Delete"
      :loading="Boolean(deleteTarget && deletePendingId === deleteTarget._id)"
      title="Delete Recipient?"
      @confirm="deleteConfirmedEmail"
    >
      This will permanently remove {{ deleteTarget?.email || 'this email recipient' }} from report
      delivery.
    </ConfirmDialog>
  </v-card>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import api from '@/plugins/axios';
import { toastError, toastSuccess } from '@/plugins/vue-toast-notification';

const emails = ref<EmailReport[]>([]);
const draftEmail = ref('');
const loading = ref(false);
const addPending = ref(false);
const deletePendingId = ref('');
const deleteConfirmVisible = ref(false);
const deleteTarget = ref<EmailReport | null>(null);

const recipientCount = computed(() => emails.value.length);
const toCount = computed(() => emails.value.filter((email) => email.tooling.to).length);
const ccCount = computed(() => emails.value.filter((email) => email.tooling.cc).length);

onMounted(() => {
  void fetchEmails();
});

async function fetchEmails() {
  loading.value = true;

  try {
    const { data } = await api.get<EmailReport[]>('/reports');
    emails.value = data.map(normalizeEmailReport);
  } catch {
    toastError('Unable to load report recipients.');
  } finally {
    loading.value = false;
  }
}

async function saveEmail(email: EmailReport) {
  email.email = normalizeEmailAddress(email.email);

  if (!email.email) {
    toastError('Email is required.');
    void fetchEmails();
    return;
  }

  if (!isValidEmail(email.email)) {
    toastError('Enter a valid email address.');
    return;
  }

  const hasDuplicate = emails.value.some(
    (candidate) =>
      candidate._id !== email._id && normalizeEmailAddress(candidate.email) === email.email,
  );

  if (hasDuplicate) {
    toastError('That email address already exists.');
    void fetchEmails();
    return;
  }

  try {
    await api.put('/reports', { report: email });
  } catch {
    toastError('Unable to update report recipient.');
    void fetchEmails();
  }
}

async function addEmail() {
  const email = normalizeEmailAddress(draftEmail.value);
  if (!email) return;

  if (!isValidEmail(email)) {
    toastError('Enter a valid email address.');
    return;
  }

  if (emails.value.some((candidate) => normalizeEmailAddress(candidate.email) === email)) {
    toastError('That email address already exists.');
    return;
  }

  addPending.value = true;

  try {
    const { data } = await api.post<EmailReport>('/reports', {
      report: {
        email,
        tooling: {
          to: toCount.value === 0,
          cc: false,
        },
      },
    });

    emails.value = [...emails.value, normalizeEmailReport(data)].sort((a, b) =>
      a.email.localeCompare(b.email),
    );
    draftEmail.value = '';
    toastSuccess('Recipient added.');
  } catch {
    toastError('Unable to add report recipient.');
  } finally {
    addPending.value = false;
  }
}

async function updateToolingTo(email: EmailReport, nextValue: boolean) {
  if (!nextValue && isOnlyToolingTo(email._id)) {
    toastError('Tooling report must have at least one To recipient.');
    return;
  }

  email.tooling.to = nextValue;
  await saveEmail(email);
}

async function updateToolingCc(email: EmailReport, nextValue: boolean) {
  email.tooling.cc = nextValue;
  await saveEmail(email);
}

function confirmDeleteEmail(email: EmailReport) {
  if (isOnlyToolingTo(email._id)) {
    toastError('Tooling report must have at least one To recipient.');
    return;
  }

  deleteTarget.value = email;
  deleteConfirmVisible.value = true;
}

async function deleteConfirmedEmail() {
  if (!deleteTarget.value) return;

  const emailId = deleteTarget.value._id;

  deletePendingId.value = emailId;

  try {
    await api.delete(`/reports/${emailId}`);
    emails.value = emails.value.filter((candidate) => candidate._id !== emailId);
    deleteConfirmVisible.value = false;
    deleteTarget.value = null;
    toastSuccess('Recipient removed.');
  } catch {
    toastError('Unable to remove report recipient.');
  } finally {
    deletePendingId.value = '';
  }
}

function normalizeEmailReport(email: EmailReport): EmailReport {
  return {
    ...email,
    email: normalizeEmailAddress(email.email),
    tooling: {
      to: Boolean(email.tooling?.to),
      cc: Boolean(email.tooling?.cc),
    },
  };
}

function normalizeEmailAddress(value: string) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function isOnlyToolingTo(emailId: string) {
  return (
    toCount.value === 1 && emails.value.some((email) => email._id === emailId && email.tooling.to)
  );
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
</script>

<style scoped>
.report-settings {
  padding: 20px;
  background:
    radial-gradient(circle at top right, rgb(var(--v-theme-primary), 0.12), transparent 30%),
    linear-gradient(180deg, rgb(var(--v-theme-surface)) 0%, rgb(var(--v-theme-surface-bright)) 100%);
}

.report-settings__hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.report-settings__eyebrow {
  margin-bottom: 6px;
  color: rgb(var(--v-theme-primary));
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.report-settings__title {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 700;
}

.report-settings__copy {
  max-width: 60ch;
  margin: 8px 0 0;
}

.report-settings__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.report-settings__composer {
  border-style: solid;
}

.report-settings__composer-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.report-settings__composer-title {
  font-size: 1rem;
  font-weight: 700;
}

.report-settings__composer-copy {
  margin-top: 4px;
}

.report-settings__table th {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.report-settings__recipient-header {
  width: 58%;
}

.report-settings__group-header {
  position: relative;
  padding-bottom: 8px;
}

.report-settings__group-header::after {
  content: "";
  position: absolute;
  right: 12px;
  bottom: 0;
  left: 12px;
  border-bottom: 1px solid rgb(var(--v-theme-outline-variant));
  max-width: 180px;
}

.report-settings__group-subheader {
  font-size: 0.72rem;
  letter-spacing: 0.04em;
  padding-top: 4px;
}

.report-settings__actions-header {
  width: 88px;
}

.report-settings__row td {
  vertical-align: middle;
}

.report-settings__recipient-cell {
  padding-right: 10px;
}

.report-settings__email-input {
  min-width: 0;
}

.report-settings__report-cell {
  width: 180px;
  padding-right: 0;
  padding-left: 0;
}

.report-settings__report-toggle-group {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 4px 8px;
  border: 1px solid rgb(var(--v-theme-outline-variant));
  border-radius: 999px;
  background: rgb(var(--v-theme-surface-bright));
}

.report-settings__checkbox {
  display: inline-flex;
  justify-content: center;
  min-width: 0;
  margin: 0;
}

.report-settings__actions-cell {
  width: 88px;
  white-space: nowrap;
}

.report-settings__empty {
  display: grid;
  place-items: center;
  gap: 10px;
  min-height: 220px;
  text-align: center;
}

.report-settings__empty-title {
  font-size: 1rem;
  font-weight: 700;
}

.report-settings__empty-copy {
  max-width: 44ch;
  margin: 0;
}

@media (max-width: 760px) {
  .report-settings {
    padding: 14px;
  }

  .report-settings__hero,
  .report-settings__composer-header {
    flex-direction: column;
  }

  .report-settings__chips {
    justify-content: flex-start;
  }

  .report-settings__recipient-header {
    width: auto;
  }

  .report-settings__report-cell,
  .report-settings__actions-header,
  .report-settings__actions-cell {
    width: auto;
  }

  .report-settings__report-toggle-group {
    gap: 8px;
    padding: 4px 8px;
  }
}
</style>

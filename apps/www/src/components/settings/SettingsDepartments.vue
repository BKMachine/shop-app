<template>
  <div class="department-settings">
    <p class="department-settings__copy">
      Manage the department list used by machine settings and department filters.
    </p>

    <div class="container">
      <SettingsTiles :items="departments" @create="create" @edit="edit" />
    </div>
  </div>

  <v-dialog v-model="dialog" max-width="420">
    <v-card>
      <v-card-title>{{ cardTitle }}</v-card-title>
      <v-card-text>
        <v-form v-model="valid">
          <v-text-field
            v-model="editingItem.name"
            label="Department"
            :rules="[rules.required, rules.counter, rules.unique]"
          />
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn color="green" :disabled="!valid" variant="elevated" @click="save">
          {{ actionText }}
        </v-btn>
        <v-btn color="red" variant="elevated" @click="close">Cancel</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import SettingsTiles from '@/components/settings/SettingsTiles.vue';
import api from '@/plugins/axios';
import { toastError, toastSuccess } from '@/plugins/vue-toast-notification';

type DepartmentForm = {
  _id?: string;
  __v?: number;
  name: string;
};

const departments = ref<Department[]>([]);
const dialog = ref(false);
const editingIndex = ref(-1);
const editingItem = ref<DepartmentForm>(createEmptyDepartment());
const valid = ref(true);

const isEditing = computed(() => editingIndex.value > -1);
const cardTitle = computed(() => `${isEditing.value ? 'Edit' : 'Add'} Department`);
const actionText = computed(() => (isEditing.value ? 'Update' : 'Save'));

const rules = {
  required: (value: string) => Boolean(value?.trim()) || 'Required',
  counter: (value: string) => value.trim().length <= 40 || 'Max 40 characters',
  unique: (value: string) => {
    const normalizedValue = value.trim().toLowerCase();
    if (!normalizedValue) return true;

    return (
      departments.value.every((department) => {
        if (department._id === editingItem.value._id) return true;
        return department.name.trim().toLowerCase() !== normalizedValue;
      }) || 'Name already used'
    );
  },
} satisfies Rules;

onMounted(() => {
  void fetchDepartments();
});

async function fetchDepartments() {
  try {
    const { data } = await api.get<Department[]>('/departments');
    departments.value = [...data].sort((left, right) => left.name.localeCompare(right.name));
  } catch (error) {
    console.error('Error fetching departments:', error);
    toastError('Unable to load departments.');
  }
}

function create() {
  editingIndex.value = -1;
  editingItem.value = createEmptyDepartment();
  dialog.value = true;
}

function edit(index: number) {
  editingIndex.value = index;
  const department = departments.value[index];
  if (department) {
    editingItem.value = {
      _id: department._id,
      __v: department.__v,
      name: department.name,
    };
  }
  dialog.value = true;
}

function close() {
  dialog.value = false;
  editingIndex.value = -1;
  editingItem.value = createEmptyDepartment();
}

async function save() {
  const payload = { name: editingItem.value.name.trim() };

  try {
    if (editingItem.value._id) {
      const { data } = await api.put<Department>('/departments', {
        department: {
          _id: editingItem.value._id,
          __v: editingItem.value.__v,
          ...payload,
        },
      });

      upsertDepartment(data);
      toastSuccess('Department updated successfully');
    } else {
      const { data } = await api.post<Department>('/departments', {
        department: payload,
      });

      upsertDepartment(data);
      toastSuccess('Department added successfully');
    }

    close();
  } catch (error) {
    console.error('Error saving department:', error);
    toastError(editingItem.value._id ? 'Failed to update department' : 'Failed to add department');
  }
}

function upsertDepartment(department: Department) {
  const index = departments.value.findIndex((item) => item._id === department._id);
  if (index > -1) {
    departments.value[index] = department;
  } else {
    departments.value.push(department);
  }

  departments.value = [...departments.value].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

function createEmptyDepartment(): DepartmentForm {
  return { name: '' };
}
</script>

<style scoped>
.department-settings {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.department-settings__copy {
  margin: 0;
}

.container {
  display: flex;
  flex-wrap: wrap;
}
</style>

import api from '@/plugins/axios';

export async function fetchDepartments(): Promise<Department[]> {
  const { data } = await api.get<Department[]>('/departments');
  return [...data].sort((left, right) => left.name.localeCompare(right.name));
}

export async function fetchMachineDepartmentOptions(): Promise<string[]> {
  const data = await fetchDepartments();
  return data
    .map((department) => department.name?.trim() || '')
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
}

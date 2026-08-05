type HasDepartment = {
  department?: string | null;
};

export function getMachineDepartmentOptions<T extends HasDepartment>(machines: T[]): string[] {
  return [
    ...new Set(machines.map((machine) => machine.department?.trim() || '').filter(Boolean)),
  ].sort((left, right) => left.localeCompare(right));
}

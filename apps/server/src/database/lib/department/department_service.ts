import Department, { type DepartmentDoc } from './department_model.js';

async function list(): Promise<DepartmentDoc[]> {
  return Department.find({}).sort({ name: 1 });
}

async function create(data: DepartmentCreate): Promise<DepartmentDoc> {
  const department = new Department({ name: data.name.trim() });
  await department.save();
  return department;
}

async function update(data: DepartmentUpdate): Promise<DepartmentDoc> {
  const updatedDepartment = await Department.findByIdAndUpdate(
    data._id,
    { name: data.name.trim() },
    { returnDocument: 'after' },
  );

  if (!updatedDepartment) {
    throw new Error(`Unable to update department document id: ${data._id}`);
  }

  return updatedDepartment;
}

export default {
  list,
  create,
  update,
};

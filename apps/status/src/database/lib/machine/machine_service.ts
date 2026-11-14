import '../department/department_model.js';
import Machine, { type MachineDoc } from './machine_model.js';

function list(): Promise<MachineDoc[]> {
  return Machine.find().populate('department').sort({ name: 1 }).lean<MachineDoc[]>();
}

export default {
  list,
};

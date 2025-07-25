import { initMachines } from '../../../machines/index.js';
import Machine, { type MachineDoc } from './machine_model.js';

function list(): Promise<MachineDoc[]> {
  return Machine.find().sort('-1');
}

async function create(data: unknown): Promise<MachineDoc> {
  const doc = new Machine(data);
  return await doc.save();
}

async function update(id: string, data: MachineDoc): Promise<MachineDoc | null> {
  const updated = await Machine.findByIdAndUpdate(id, data, { new: true });
  await initMachines();
  return updated;
}

async function remove(id: string): Promise<void> {
  await Machine.findByIdAndDelete(id);
  await initMachines();
}
export default {
  list,
  create,
  update,
  remove,
};

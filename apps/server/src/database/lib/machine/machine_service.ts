import '../department/department_model.js';
import Machine, { type MachineDoc } from './machine_model.js';

export interface MachineFields {
  name: string;
  displayName: string;
  serialNumber: string;
  brand: MachineBrand;
  model: string;
  source: MachineSource;
  type: MachineType;
  paths: '1' | '2';
  department: string | null;
  location: string;
}

/** The status service reads these documents too, and picks up changes to them by itself. */
async function list(): Promise<MachineConfig[]> {
  const docs = await Machine.find().populate('department').sort({ name: 1 }).lean<MachineDoc[]>();
  return docs.map(toConfig);
}

async function create(fields: MachineFields): Promise<MachineConfig> {
  const { _id } = await Machine.create(fields);
  const created = await find(_id.toString());
  if (!created) throw new Error(`Unable to read back machine document id: ${_id}`);
  return created;
}

async function update(id: string, fields: MachineFields): Promise<MachineConfig | null> {
  const updated = await Machine.findByIdAndUpdate(id, fields, { runValidators: true });
  return updated ? find(id) : null;
}

async function find(id: string): Promise<MachineConfig | null> {
  const doc = await Machine.findById(id).populate('department').lean<MachineDoc>();
  return doc ? toConfig(doc) : null;
}

function toConfig(doc: MachineDoc): MachineConfig {
  const { department } = doc;
  // Old documents can hold the department's name rather than a reference to it.
  const departmentName =
    typeof department === 'string'
      ? department
      : department && 'name' in department
        ? department.name.trim()
        : '';
  const departmentId =
    !department || typeof department === 'string' ? null : department._id.toString();

  return {
    id: doc._id.toString(),
    name: doc.name,
    displayName: doc.displayName || doc.name,
    serialNumber: doc.serialNumber,
    brand: doc.brand,
    model: doc.model,
    source: doc.source,
    type: doc.type,
    paths: doc.paths,
    departmentId,
    department: departmentName,
    location: doc.location,
  };
}

export default {
  list,
  create,
  update,
};

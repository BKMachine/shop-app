import Printer, { type PrinterDoc } from './printer_model.js';

/** The shop's printers, added the first time the server starts with no printers saved. */
const DEFAULT_PRINTERS: PrinterCreate[] = [
  { name: 'Sharp', hostname: 'sharp.bkmachine.lan', showInAndroid: true },
  { name: 'Brother', hostname: 'brother.bkmachine.lan', showInAndroid: true },
];

async function list(): Promise<PrinterDoc[]> {
  return Printer.find({}).sort({ name: 1 });
}

async function findById(id: string): Promise<PrinterDoc | null> {
  return Printer.findById(id);
}

async function create(data: PrinterCreate): Promise<PrinterDoc> {
  const printer = new Printer(data);
  await printer.save();
  return printer;
}

async function update(data: PrinterUpdate): Promise<PrinterDoc> {
  const { _id, __v: _version, ...fields } = data;
  const updatedPrinter = await Printer.findByIdAndUpdate(_id, fields, {
    returnDocument: 'after',
    runValidators: true,
  });

  if (!updatedPrinter) {
    throw new Error(`Unable to update printer document id: ${_id}`);
  }

  return updatedPrinter;
}

/** Adds the default printers when none exist yet. Returns how many were added. */
async function seedDefaults(): Promise<number> {
  if (await Printer.exists({})) return 0;
  await Printer.insertMany(DEFAULT_PRINTERS);
  return DEFAULT_PRINTERS.length;
}

export default {
  list,
  findById,
  create,
  update,
  seedDefaults,
};

import { type HydratedDocument, model, Schema } from 'mongoose';

const schema = new Schema<PrinterFields>({
  name: { type: String, unique: true, required: true, trim: true },
  hostname: { type: String, unique: true, required: true, trim: true, lowercase: true },
  showInAndroid: { type: Boolean, default: true },
});

export default model<PrinterFields>('printers', schema);
export type PrinterDoc = HydratedDocument<PrinterFields>;

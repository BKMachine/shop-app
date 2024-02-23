import { Schema, model } from 'mongoose';

const schema = new Schema<ToolManufacturerDoc>({
  name: { type: String, unique: true },
  logo: String,
});

export default model<ToolManufacturerDoc>('tool_manufacturers', schema);

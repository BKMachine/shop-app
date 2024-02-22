import { Schema, model } from 'mongoose';

const schema = new Schema<ToolManufacturerDoc>({
  name: String,
  logo: String,
});

export default model<ToolManufacturerDoc>('tool_manufacturers', schema);

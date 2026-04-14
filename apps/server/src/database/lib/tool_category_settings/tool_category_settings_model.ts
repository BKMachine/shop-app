import { model, Schema } from 'mongoose';

const groupsSchema = new Schema<ToolCategoryGroups>(
  {
    milling: { type: [String], default: [] },
    turning: { type: [String], default: [] },
    swiss: { type: [String], default: [] },
    other: { type: [String], default: [] },
  },
  { _id: false },
);

const schema = new Schema<ToolCategorySettings>({
  _id: { type: String, default: 'tool-categories' },
  groups: {
    type: groupsSchema,
    required: true,
    default: () => ({
      milling: [],
      turning: [],
      swiss: [],
      other: [],
    }),
  },
});

export default model<ToolCategorySettings>(
  'tool_category_settings',
  schema,
  'tool_category_settings',
);

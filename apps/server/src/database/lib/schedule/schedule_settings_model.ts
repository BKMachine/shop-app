import { model, Schema } from 'mongoose';

export const SCHEDULE_SETTINGS_ID = 'schedule-settings';

type ScheduleSettingsDocumentFields = ScheduleSettings & { _id: string };

const schema = new Schema<ScheduleSettingsDocumentFields>(
  {
    _id: { type: String, default: SCHEDULE_SETTINGS_ID },
    workdayStartHour: { type: Number, required: true },
    workdayEndHour: { type: Number, required: true },
    workdays: { type: [Number], required: true },
    defaultUtilization: { type: Number, required: true },
    departmentUtilization: { type: Map, of: Number, default: {} },
  },
  { minimize: false },
);

export default model<ScheduleSettingsDocumentFields>(
  'schedule_settings',
  schema,
  'schedule_settings',
);

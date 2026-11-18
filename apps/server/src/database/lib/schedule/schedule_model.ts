import { type HydratedDocument, model, Schema, type Types } from 'mongoose';

export interface ScheduleEntryFields {
  job: Types.ObjectId;
  machineId: string;
  /** First booked day, `YYYY-MM-DD`. */
  start: string;
  /** The day after the last booked day, `YYYY-MM-DD`; kept so range queries can use an index. */
  end: string;
  days: number;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ScheduleEntryFields>(
  {
    job: { type: Schema.Types.ObjectId, ref: 'jobs', required: true, index: true },
    machineId: { type: String, required: true, index: true },
    start: { type: String, required: true },
    end: { type: String, required: true, index: true },
    days: { type: Number, required: true, min: 1 },
  },
  {
    timestamps: true,
  },
);

export default model<ScheduleEntryFields>('schedule_entries', schema);
export type ScheduleEntryDoc = HydratedDocument<ScheduleEntryFields>;

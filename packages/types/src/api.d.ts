// Material types are in materials.d.ts
// Part types are in parts.d.ts
// Tool types are in tooling.d.ts

import type { Document, Types } from 'mongoose';

// _id is a string for the frontend
// _id is a Mongoose ObjectId for backend Documents

declare global {
  interface PaginatedResult<T> {
    items: T[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  }

  interface PaginatedResultWithValue<T> extends PaginatedResult<T> {
    totalValue: number;
  }

  /* AUDIT */

  interface Audit {
    _id: string;
    mergedCount?: number;
    type:
      | 'tool'
      | 'material'
      | 'part'
      | 'job'
      | 'shipment'
      | 'image'
      | 'document'
      | 'customer'
      | 'supplier'
      | 'shipper'
      | 'vendor'
      | 'report'
      | 'part_note'
      | 'schedule';
    timestamp: string;
    device: Device;
    old: any | null;
    new: any | null;
  }

  interface AuditDoc extends Omit<Audit, '_id'>, Document<Types.ObjectId> {
    _id: Types.ObjectId;
  }

  interface PartyFields {
    name: string;
    logo?: string;
    homepage?: string;
  }

  /* CUSTOMER */

  interface CustomerFields extends PartyFields {
    /** `#rrggbb` used for the customer's jobs on the schedule; empty uses the default. */
    color?: string;
  }

  interface Customer extends CustomerFields {
    _id: string;
  }

  interface CustomerCreate extends CustomerFields {}

  interface CustomerUpdate extends CustomerFields {
    _id: string;
    __v?: number;
  }

  /* DEPARTMENT */

  interface DepartmentFields {
    name: string;
  }

  interface Department extends DepartmentFields {
    _id: string;
    __v?: number;
  }

  interface DepartmentCreate extends DepartmentFields {}

  interface DepartmentUpdate extends DepartmentFields {
    _id: string;
    __v?: number;
  }

  /* REPORT */

  interface Email {
    to: boolean;
    cc: boolean;
  }

  interface JobReportSchedule {
    daily: boolean;
    weekly: boolean;
  }

  interface EmailReportFields {
    email: string;
    tooling: Email;
    jobs: JobReportSchedule;
  }

  interface EmailReport extends EmailReportFields {
    _id: string;
  }

  interface EmailReportCreate extends EmailReportFields {}

  interface EmailReportUpdate extends EmailReportFields {
    _id: string;
    __v?: number;
  }

  /* SUPPLIER */

  interface SupplierFields extends PartyFields {}

  interface Supplier extends SupplierFields {
    _id: string;
  }

  interface SupplierCreate extends SupplierFields {}

  interface SupplierUpdate extends SupplierFields {
    _id: string;
    __v?: number;
  }

  /* SHIPPER */

  interface ShipperFields extends PartyFields {}

  interface Shipper extends ShipperFields {
    _id: string;
  }

  interface ShipperCreate extends ShipperFields {}

  interface ShipperUpdate extends ShipperFields {
    _id: string;
    __v?: number;
  }

  /* VENDOR */

  interface VendorFields extends PartyFields {
    coatings?: string[];
  }

  interface Vendor extends VendorFields {
    _id: string;
  }

  interface VendorCreate extends VendorFields {}

  interface VendorUpdate extends VendorFields {
    _id: string;
    __v?: number;
  }

  /* IMAGE */

  interface ImageFields {
    filename: string;
    relPath: string;
    mimeType?: string;
    status: 'temp' | 'attached';
    entityType:
      | 'tool'
      | 'part'
      | 'customer'
      | 'supplier'
      | 'shipper'
      | 'vendor'
      | 'shipment'
      | null;
    entityId: string | null;
    expiresAt?: Date | null;
  }

  /* SHIPMENT */

  interface ShipmentFields {
    shippedAt: string | Date;
    customer?: string | Customer | null;
    shipper?: string | Shipper | null;
    orderNumber?: string;
    trackingNumber?: string;
    carrier?: string;
    notes?: string;
    imageIds?: string[];
  }

  interface Shipment extends ShipmentFields {
    _id: string;
    createdAt: string | Date;
    updatedAt: string | Date;
  }

  interface ShipmentCreate extends ShipmentFields {}

  interface ShipmentUpdate extends ShipmentFields {
    _id: string;
    __v?: number;
  }

  interface ShipmentListResponse extends PaginatedResult<Shipment> {}

  /* JOB */

  type JobStatus = 'open' | 'in_process' | 'machining_complete' | 'closed';

  type JobListStatusFilter = JobStatus | 'not_closed';

  type JobPriority = 'low' | 'normal' | 'rush';

  interface JobProductionTaskRun {
    startedAt: string | Date;
    endedAt?: string | Date | null;
  }

  interface JobProductionTask {
    id: string;
    machineId: string;
    machineName: string;
    machineType: MachineType;
    /** Routing op number (10, 20...) the task works on, as numbered when it started. */
    op?: number | null;
    /** Routing operation name, snapshotted when the task started. */
    operation?: string | null;
    /** First start of the task. */
    startedAt: string | Date;
    /** Latest end of the task; null while a run is active. */
    endedAt?: string | Date | null;
    /** Individual start/stop periods; only present once a task has been reopened. */
    runs?: JobProductionTaskRun[];
  }

  interface JobShipmentScheduleEntry {
    shipDate: string | Date;
    qty: number;
    po?: string;
  }

  interface JobShipmentRecord {
    id: string;
    shippedAt: string | Date;
    qty: number;
    po?: string;
  }

  interface JobFields {
    customer: string | Customer;
    part: string | Part;
    qty: number;
    actualProductionQty?: number | null;
    status: JobStatus;
    dueDate?: string | Date | null;
    startedOn?: string | Date | null;
    completedOn?: string | Date | null;
    materialOrderedOn?: string | Date | null;
    materialOnHandOn?: string | Date | null;
    customerPo?: string;
    priority?: JobPriority;
    notes?: string;
    customerName?: string;
    partNumber?: string;
    partDescription?: string;
    partRevision?: string;
    shipmentSchedule?: JobShipmentScheduleEntry[];
    shipmentRecords?: JobShipmentRecord[];
    productionTasks?: JobProductionTask[];
  }

  interface Job extends JobFields {
    _id: string;
    jobNumber: number;
    createdAt: string | Date;
    updatedAt: string | Date;
  }

  interface JobCreate extends JobFields {}

  interface JobUpdate extends JobFields {
    _id: string;
    jobNumber: number;
    __v?: number;
  }

  interface JobListQuery {
    search?: string;
    jobNumber?: number;
    customer?: string;
    part?: string;
    status?: JobListStatusFilter;
    dueBefore?: string;
    dueAfter?: string;
    sort?: string;
    order?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  }

  interface JobListResponse extends PaginatedResultWithValue<Job> {}

  interface JobHistoryListResponse extends PaginatedResult<Job> {}

  /* SCHEDULE */

  /** The job fields a schedule tile needs, read from the job when the schedule is loaded. */
  interface ScheduleEntryJob {
    _id: string;
    jobNumber: number;
    customerId: string;
    customerName: string;
    partNumber: string;
    partDescription: string;
    qty: number;
    /** `YYYY-MM-DD`, or null when the job has no due date. */
    dueDate: string | null;
    status: JobStatus;
    priority: JobPriority;
  }

  /** A job booked onto a machine for a run of whole days. */
  interface ScheduleEntry {
    _id: string;
    job: ScheduleEntryJob;
    /**
     * `_id` of the routing op booked. It stays with the op when ops are inserted, removed or
     * reordered, so the op's current number and name come from the routing, not `op`/`operation`.
     * Null for a whole job.
     */
    routingId?: string | null;
    /** Routing op number when it was booked (10, 20...); null when the whole job is booked. */
    op?: number | null;
    /** The op's name, as it was when booked. */
    operation?: string | null;
    /** The op's department `_id` when booked; it can only go on that department's machines. */
    department?: string | null;
    machineId: string;
    /** First scheduled day, `YYYY-MM-DD`. */
    start: string;
    /** Whole days booked, at least 1. */
    days: number;
  }

  interface ScheduleEntryCreate {
    job: string;
    routingId?: string | null;
    op?: number | null;
    operation?: string | null;
    department?: string | null;
    machineId: string;
    start: string;
    days: number;
  }

  /** How the schedule turns a job's cycle time into a booking length. */
  interface ScheduleSettings {
    /** Hour the working day starts, 0–23. */
    workdayStartHour: number;
    /** Hour the working day ends, 1–24, after the start. */
    workdayEndHour: number;
    /** Working days of the week, 0 = Sunday ... 6 = Saturday. */
    workdays: number[];
    /** Percent of the working day a machine is actually cutting, for departments not listed. */
    defaultUtilization: number;
    /** Percent of the working day a machine is actually cutting, by department `_id`. */
    departmentUtilization: Record<string, number>;
  }

  /** A new machine, start or length for an existing entry. */
  interface ScheduleEntryPlacement {
    _id: string;
    machineId: string;
    start: string;
    days: number;
  }

  interface MachineJobDashboardRow {
    machineId: string;
    machineName: string;
    machineType: MachineType;
    department: string;
    location: string;
    hasInProcessJob: boolean;
    priority?: JobPriority | null;
    taskId?: string | null;
    taskStartedAt?: string | Date | null;
    jobId?: string | null;
    jobNumber?: number | null;
    qty?: number | null;
    dueDate?: string | Date | null;
    partId?: string | null;
    partNumber?: string | null;
    partDescription?: string | null;
    partImage?: string | null;
    partHasIncompleteData?: boolean;
    partHourlyRate?: number | null;
    partSummary: string;
    /** The job booked on this machine for today on the schedule, if any. */
    scheduledJobId?: string | null;
    scheduledJobNumber?: number | null;
    /** This row's in-process job is not the job the schedule has on the machine today. */
    scheduleMismatch?: boolean;
  }

  interface MachineJobDashboardResponse {
    active: MachineJobDashboardRow[];
    idle: MachineJobDashboardRow[];
  }

  interface Image extends ImageFields {
    _id: string;
    createdAt: Date;
    updatedAt: Date;
  }

  interface ImageCreate extends ImageFields {}

  interface ImageUpdate extends ImageFields {
    _id: string;
    createdAt?: Date;
    updatedAt?: Date;
    __v?: number;
  }

  /* STORED DOCUMENT */

  interface StoredDocumentFields {
    filename: string;
    originalName: string;
    relPath: string;
    mimeType?: string;
    extension?: string;
    size: number;
    entityType: 'part' | null;
    entityId: string | null;
  }

  interface StoredDocument extends StoredDocumentFields {
    _id: string;
    createdAt: Date;
    updatedAt: Date;
  }

  interface StoredDocumentCreate extends StoredDocumentFields {}

  interface StoredDocumentUpdate extends StoredDocumentFields {
    _id: string;
    createdAt?: Date;
    updatedAt?: Date;
    __v?: number;
  }

  /* PART NOTE */

  interface PartNoteFields {
    partId: string;
    text: string;
    priority: 'critical' | 'default';
    createdByDeviceId: string;
    createdByDisplayName: string;
    updatedByDeviceId: string;
    updatedByDisplayName: string;
  }

  interface PartNote extends PartNoteFields {
    _id: string;
    createdAt: Date;
    updatedAt: Date;
  }

  interface PartNoteCreate {
    text: string;
    priority: 'critical' | 'default';
  }

  interface PartNoteUpdate extends PartNoteCreate {
    _id: string;
    __v?: number;
  }

  /* DEVICE */

  interface DeviceFields {
    deviceId: string;
    displayName: string;
    deviceType: 'pc' | 'android' | 'unknown';
    isAdmin: boolean;
    isLan: boolean;
    approved: boolean;
    blocked: boolean;
    firstSeenAt: Date;
    lastSeenAt: Date;
    lastIp: string | null;
    lastUserAgent: string | null;
    createdAt: Date;
    updatedAt: Date;
  }

  interface Device extends DeviceFields {
    _id: string;
  }

  interface DeviceCreate extends DeviceFields {}

  interface DeviceUpdate extends DeviceFields {
    _id: string;
    __v?: number;
  }
}

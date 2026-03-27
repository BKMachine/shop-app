import type { Document, Types } from 'mongoose';

// _id is a string for the frontend
// _id is a Mongoose ObjectId for backend Documents

declare global {
  /* AUDIT */

  interface Audit {
    _id: string;
    type: 'tool' | 'material' | 'part';
    timestamp: string;
    device: Device;
    old: any | null;
    new: any;
  }

  interface AuditDoc extends Omit<Audit, '_id'>, Document<Types.ObjectId> {
    _id: Types.ObjectId;
  }

  /* CUSTOMER */

  interface Customer {
    _id: string;
    name: string;
    logo?: string;
    homepage?: string;
  }

  interface CustomerDoc extends Omit<Customer, '_id'>, Document<Types.ObjectId> {
    _id: Types.ObjectId;
  }

  /* REPORT */

  interface EmailReport {
    _id: string;
    email: string;
    tooling: Email;
  }

  interface Email {
    to: boolean;
    cc: boolean;
  }

  interface EmailReportDoc extends Omit<EmailReport, '_id'>, Document<Types.ObjectId> {
    _id: Types.ObjectId;
  }

  /* MATERIAL */

  interface Material {
    _id: string;
    description: string;
    type: 'Round' | 'Flat';
    height: number | null;
    width: number | null;
    diameter: number | null;
    wallThickness: number | null;
    length: number | null;
    materialType: string;
    supplier?: Supplier | string;
    costPerFoot: number | null;
  }

  interface MaterialDoc extends Omit<Material, '_id'>, Document<Types.ObjectId> {
    _id: Types.ObjectId;
  }

  /* PART */

  interface CycleTimes {
    operation: string;
    time: number;
  }

  interface AdditionalCost {
    name: string;
    cost: number;
    url?: string;
  }

  interface Part {
    _id: string;
    customer: Customer | string;
    part: string;
    description: string;
    stock: number;
    location?: string;
    position?: string;
    img?: string;
    productLink?: string;
    revision?: string;
    material?: Material | string;
    customerSuppliedMaterial?: boolean;
    materialCutType: 'blanks' | 'bars';
    materialLength: number;
    barLength: number;
    remnantLength: number;
    createdAt: Date;
    cycleTimes: CycleTimes[];
    additionalCosts: AdditionalCost[];
    price: number;
    imageIds?: string[];
  }

  interface PartDoc extends Omit<Part, '_id'>, Document<Types.ObjectId> {
    _id: Types.ObjectId;
  }

  /* TOOL */

  interface ToolDoc extends Omit<Tool, '_id'>, Document<Types.ObjectId> {
    _id: Types.ObjectId;
  }

  /* SUPPLIER */

  interface Supplier {
    _id: string;
    name: string;
    logo?: string;
    homepage?: string;
  }

  interface SupplierDoc extends Omit<Supplier, '_id'>, Document<Types.ObjectId> {
    _id: Types.ObjectId;
  }

  /* VENDOR */

  interface Vendor {
    _id: string;
    name: string;
    logo?: string;
    homepage?: string;
    coatings?: string[];
  }

  interface VendorDoc extends Omit<Vendor, '_id'>, Document<Types.ObjectId> {
    _id: Types.ObjectId;
  }

  /* IMAGE */

  interface Image {
    _id: string;
    filename: string;
    relPath: string;
    mimeType?: string;
    status: 'temp' | 'attached';
    entityType: 'tool' | 'part' | 'customer' | 'supplier' | 'vendor' | null;
    entityId: string | null;
    expiresAt?: Date;
    createdAt: Date;
    updatedAt: Date;
  }

  interface ImageDoc extends Omit<Image, '_id'>, Document<Types.ObjectId> {
    _id: Types.ObjectId;
  }

  /* DEVICE */

  interface Device {
    _id: string;
    deviceId: string;
    displayName: string;
    deviceType: 'pc' | 'android' | 'unknown';
    approved: boolean;
    blocked: boolean;
    firstSeenAt: Date;
    lastSeenAt: Date;
    lastIp: string | null;
    lastUserAgent: string | null;
    createdAt: Date;
    updatedAt: Date;
  }

  interface DeviceDoc extends Omit<Device, '_id'>, Document<Types.ObjectId> {
    _id: Types.ObjectId;
  }
}
